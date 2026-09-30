import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAll } from '@/lib/fetchAll';
import type { BusinessAsset, BusinessOperation, BusinessReceivable, BusinessPayment, Collateral } from '@/lib/commercial';

export const commercialDb = supabase as any;
export function useCommercial(clientId?: string) {
  const {user}=useAuth();const queryClient=useQueryClient();
  const query=useQuery({queryKey:['commercial',user?.id,clientId||'all'],enabled:!!user,queryFn:async()=>{
    const table=(name:string)=>commercialDb.from(name).select('*').eq('user_id',user!.id);
    const [assets,operations,receivables,payments,collateral]=await Promise.all([
      fetchAll<BusinessAsset>((f,t)=>table('business_assets').order('created_at',{ascending:false}).range(f,t)),
      fetchAll<BusinessOperation>((f,t)=>(clientId?table('business_operations').eq('client_id',clientId):table('business_operations')).order('created_at',{ascending:false}).range(f,t)),
      fetchAll<BusinessReceivable>((f,t)=>table('business_receivables').order('due_date').range(f,t)),
      fetchAll<BusinessPayment>((f,t)=>table('business_payments').order('created_at',{ascending:false}).range(f,t)),
      fetchAll<Collateral>((f,t)=>(clientId?table('loan_collateral').eq('client_id',clientId):table('loan_collateral')).order('received_at',{ascending:false}).range(f,t)),
    ]);return {assets,operations,receivables,payments,collateral};
  }});
  const refresh=()=>Promise.all(['commercial','carteira-business','client-transactions','dashboard-data'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));
  return {...query,data:query.data||{assets:[],operations:[],receivables:[],payments:[],collateral:[]},refresh};
}
export async function commercialRpc(name:string,args:Record<string,unknown>) {
  const {data,error}=await commercialDb.rpc(name,args);if(error)throw error;return data;
}
