-- Inventory, sales, rentals and voluntary loan collateral. Mutations are atomic,
-- tenant scoped, idempotent and serialize access to inventory and receivables.
CREATE TABLE public.business_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK(kind IN ('phone','car','motorcycle')),
  label text NOT NULL CHECK(length(trim(label)) BETWEEN 2 AND 150),
  identifier text NOT NULL CHECK(length(trim(identifier)) BETWEEN 3 AND 50),
  cost numeric(14,2) NOT NULL DEFAULT 0 CHECK(cost>=0),
  price numeric(14,2) NOT NULL DEFAULT 0 CHECK(price>=0),
  condition text NOT NULL DEFAULT 'Usado', notes text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(photos)='array'),
  details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),
  status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','sold','rented','maintenance','archived')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,kind,identifier), UNIQUE(id,user_id)
);
CREATE TABLE public.business_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  asset_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('sale','rental')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  total numeric(14,2) NOT NULL CHECK(total>0), down_payment numeric(14,2) NOT NULL DEFAULT 0 CHECK(down_payment>=0),
  deposit numeric(14,2) NOT NULL DEFAULT 0 CHECK(deposit>=0), deposit_returned numeric(14,2) NOT NULL DEFAULT 0 CHECK(deposit_returned>=0),
  start_date date NOT NULL, end_date date, returned_at timestamptz,
  billing text NOT NULL DEFAULT 'monthly' CHECK(billing IN ('daily','weekly','monthly')),
  rate numeric(14,2) NOT NULL DEFAULT 0 CHECK(rate>=0),
  notes text NOT NULL DEFAULT '', details jsonb NOT NULL DEFAULT '{}',
  request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id), UNIQUE(id,user_id),
  FOREIGN KEY(asset_id,user_id) REFERENCES public.business_assets(id,user_id),
  CHECK(down_payment<=total), CHECK(deposit_returned<=deposit), CHECK(end_date IS NULL OR end_date>=start_date)
);
CREATE TABLE public.business_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  operation_id uuid NOT NULL, number integer NOT NULL CHECK(number>0),
  amount numeric(14,2) NOT NULL CHECK(amount>0), paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(paid_amount>=0),
  due_date date NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
  UNIQUE(operation_id,number), UNIQUE(id,user_id), CHECK(paid_amount<=amount),
  FOREIGN KEY(operation_id,user_id) REFERENCES public.business_operations(id,user_id)
);
CREATE TABLE public.business_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  operation_id uuid NOT NULL, receivable_id uuid,
  kind text NOT NULL CHECK(kind IN ('receipt','down_payment','deposit','deposit_refund','refund')),
  amount numeric(14,2) NOT NULL CHECK(amount>0), method text NOT NULL CHECK(method IN ('pix','cash','card','transfer')),
  request_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id), FOREIGN KEY(operation_id,user_id) REFERENCES public.business_operations(id,user_id),
  FOREIGN KEY(receivable_id,user_id) REFERENCES public.business_receivables(id,user_id)
);
CREATE TABLE public.loan_collateral (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id), client_id uuid NOT NULL REFERENCES public.clients(id),
  description text NOT NULL CHECK(length(trim(description)) BETWEEN 3 AND 500),
  category text NOT NULL, identifier text NOT NULL DEFAULT '', estimated_value numeric(14,2) NOT NULL CHECK(estimated_value>0),
  condition text NOT NULL DEFAULT '', storage_location text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(photos)='array'), notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'held' CHECK(status IN ('held','returned')),
  received_at timestamptz NOT NULL DEFAULT now(), returned_at timestamptz, return_note text,
  request_id uuid NOT NULL, UNIQUE(user_id,request_id)
);
CREATE INDEX ON public.business_operations(user_id,client_id,created_at DESC);
CREATE INDEX ON public.business_receivables(user_id,due_date) WHERE status='pending';
CREATE INDEX ON public.loan_collateral(user_id,contract_id);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['business_assets','business_operations','business_receivables','business_payments','loan_collateral'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING(user_id=auth.uid())',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  END LOOP;
END $$;

CREATE FUNCTION public.save_business_asset(_data jsonb, _id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); asset public.business_assets%rowtype; result uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF _id IS NOT NULL THEN
    SELECT * INTO asset FROM business_assets WHERE id=_id AND user_id=uid FOR UPDATE;
    IF asset.id IS NULL THEN RAISE EXCEPTION 'Bem não encontrado'; END IF;
    IF asset.status IN ('sold','rented') THEN RAISE EXCEPTION 'Bem vinculado a uma operação; não pode ser alterado'; END IF;
  END IF;
  IF (_data->>'kind') NOT IN ('phone','car','motorcycle') OR nullif(trim(_data->>'label'),'') IS NULL OR nullif(trim(_data->>'identifier'),'') IS NULL THEN RAISE EXCEPTION 'Informe tipo, descrição e identificação'; END IF;
  IF _data->>'kind'='phone' AND (_data->>'identifier') !~ '^\d{15}$' THEN RAISE EXCEPTION 'IMEI deve ter 15 dígitos'; END IF;
  IF _data->>'kind' IN ('car','motorcycle') AND upper(_data->>'identifier') !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$' THEN RAISE EXCEPTION 'Placa inválida'; END IF;
  IF coalesce(_data->>'status','available') NOT IN ('available','maintenance','archived') THEN RAISE EXCEPTION 'Situação inválida'; END IF;
  IF _id IS NULL THEN
    INSERT INTO business_assets(user_id,kind,label,identifier,cost,price,condition,notes,photos,details)
    VALUES(uid,_data->>'kind',trim(_data->>'label'),upper(trim(_data->>'identifier')),coalesce((_data->>'cost')::numeric,0),coalesce((_data->>'price')::numeric,0),coalesce(_data->>'condition','Usado'),coalesce(_data->>'notes',''),coalesce(_data->'photos','[]'),coalesce(_data->'details','{}')) RETURNING id INTO result;
  ELSE
    UPDATE business_assets SET label=trim(_data->>'label'),identifier=upper(trim(_data->>'identifier')),cost=coalesce((_data->>'cost')::numeric,0),price=coalesce((_data->>'price')::numeric,0),condition=coalesce(_data->>'condition','Usado'),notes=coalesce(_data->>'notes',''),photos=coalesce(_data->'photos','[]'),details=coalesce(_data->'details','{}'),status=coalesce(_data->>'status','available') WHERE id=_id;
    result:=_id;
  END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.create_business_operation(_data jsonb, _request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); asset business_assets%rowtype; result uuid; total numeric; entry numeric; deposit numeric;
  start_at date; end_at date; due date; billing text; rate numeric; count integer; n integer; cents bigint; part bigint; remaining bigint; op_kind text;
BEGIN
  IF uid IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Identificação da operação obrigatória'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_request_id::text,0));
  SELECT id INTO result FROM business_operations WHERE user_id=uid AND request_id=_request_id; IF result IS NOT NULL THEN RETURN result; END IF;
  PERFORM 1 FROM clients WHERE id=(_data->>'client_id')::uuid AND user_id=uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado'; END IF;
  SELECT * INTO asset FROM business_assets WHERE id=(_data->>'asset_id')::uuid AND user_id=uid FOR UPDATE;
  IF asset.id IS NULL OR asset.status<>'available' THEN RAISE EXCEPTION 'Bem indisponível para esta operação'; END IF;
  op_kind:=_data->>'kind'; billing:=coalesce(_data->>'billing','monthly');
  start_at:=(_data->>'start_date')::date; due:=coalesce((_data->>'first_due')::date,start_at);
  IF start_at IS NULL OR due<start_at OR billing NOT IN ('daily','weekly','monthly') THEN RAISE EXCEPTION 'Datas ou frequência inválidas'; END IF;
  entry:=round(coalesce((_data->>'down_payment')::numeric,0),2); deposit:=round(coalesce((_data->>'deposit')::numeric,0),2);
  IF op_kind='sale' THEN
    IF asset.kind<>'phone' THEN RAISE EXCEPTION 'Selecione um celular disponível'; END IF;
    total:=round((_data->>'total')::numeric,2);count:=(_data->>'installments')::integer;rate:=0;deposit:=0;
  ELSIF op_kind='rental' THEN
    IF asset.kind NOT IN ('car','motorcycle') THEN RAISE EXCEPTION 'Selecione um veículo disponível'; END IF;
    end_at:=(_data->>'end_date')::date;rate:=round((_data->>'rate')::numeric,2);count:=0;due:=start_at;
    IF end_at IS NULL OR end_at<=start_at OR end_at>start_at+interval '5 years' OR rate IS NULL OR rate<=0 THEN RAISE EXCEPTION 'Informe período de locação e valor válidos'; END IF;
    WHILE due<end_at LOOP
      count:=count+1;
      due:=CASE billing WHEN 'daily' THEN start_at+count WHEN 'weekly' THEN start_at+7*count ELSE (start_at+make_interval(months=>count))::date END;
    END LOOP;
    total:=rate*count;entry:=0;
  ELSE RAISE EXCEPTION 'Operação inválida'; END IF;
  IF total IS NULL OR total<=0 OR total>999999999 OR entry<0 OR entry>total OR deposit<0 OR count IS NULL OR count<1 OR count>366 THEN RAISE EXCEPTION 'Confira valores e quantidade de parcelas (máximo 366)'; END IF;
  remaining:=round((total-entry)*100)::bigint;
  IF remaining>0 AND remaining<count THEN RAISE EXCEPTION 'Valor insuficiente para dividir em parcelas'; END IF;
  INSERT INTO business_operations(user_id,client_id,asset_id,kind,total,down_payment,deposit,start_date,end_date,billing,rate,notes,details,request_id)
  VALUES(uid,(_data->>'client_id')::uuid,asset.id,op_kind,total,entry,deposit,start_at,end_at,billing,rate,coalesce(_data->>'notes',''),coalesce(_data->'details','{}'),_request_id) RETURNING id INTO result;
  IF remaining>0 THEN
    FOR n IN 1..count LOOP
      cents:=remaining/count+CASE WHEN n<=remaining%count THEN 1 ELSE 0 END;
      due:=CASE billing WHEN 'daily' THEN coalesce((_data->>'first_due')::date,start_at)+(n-1) WHEN 'weekly' THEN coalesce((_data->>'first_due')::date,start_at)+7*(n-1) ELSE (coalesce((_data->>'first_due')::date,start_at)+make_interval(months=>n-1))::date END;
      IF op_kind='rental' THEN due:=CASE billing WHEN 'daily' THEN start_at+n-1 WHEN 'weekly' THEN start_at+7*(n-1) ELSE (start_at+make_interval(months=>n-1))::date END; END IF;
      INSERT INTO business_receivables(user_id,operation_id,number,amount,due_date) VALUES(uid,result,n,cents/100.0,due);
    END LOOP;
  END IF;
  IF entry>0 THEN
    INSERT INTO business_payments(user_id,operation_id,kind,amount,method,request_id) VALUES(uid,result,'down_payment',entry,coalesce(_data->>'method','pix'),gen_random_uuid());
  END IF;
  IF deposit>0 THEN
    INSERT INTO business_payments(user_id,operation_id,kind,amount,method,request_id) VALUES(uid,result,'deposit',deposit,coalesce(_data->>'method','pix'),gen_random_uuid());
  END IF;
  UPDATE business_assets SET status=CASE WHEN op_kind='sale' THEN 'sold' ELSE 'rented' END WHERE id=asset.id;
  IF op_kind='sale' AND remaining=0 THEN UPDATE business_operations SET status='completed' WHERE id=result; END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(uid,'create','business_operation',result,jsonb_build_object('kind',op_kind,'total',total));
  RETURN result;
END $$;

CREATE FUNCTION public.receive_business_payment(_receivable_id uuid,_amount numeric,_method text,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); r business_receivables%rowtype; op business_operations%rowtype; result uuid;
BEGIN
  IF uid IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificação obrigatórias'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_request_id::text,0));
  SELECT id INTO result FROM business_payments WHERE user_id=uid AND request_id=_request_id;IF result IS NOT NULL THEN RETURN result;END IF;
  SELECT o.* INTO op FROM business_operations o JOIN business_receivables r ON r.operation_id=o.id WHERE r.id=_receivable_id AND o.user_id=uid FOR UPDATE OF o;
  IF op.id IS NULL OR op.status='cancelled' THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  SELECT * INTO r FROM business_receivables WHERE id=_receivable_id AND user_id=uid FOR UPDATE;
  IF r.status<>'pending' OR _amount IS NULL OR _amount<=0 OR round(_amount,2)<>_amount OR _amount>r.amount-r.paid_amount THEN RAISE EXCEPTION 'Pagamento deve ser maior que zero e não exceder o saldo'; END IF;
  INSERT INTO business_payments(user_id,operation_id,receivable_id,kind,amount,method,request_id) VALUES(uid,r.operation_id,r.id,'receipt',_amount,_method,_request_id) RETURNING id INTO result;
  UPDATE business_receivables SET paid_amount=paid_amount+_amount,status=CASE WHEN paid_amount+_amount=amount THEN 'paid' ELSE 'pending' END WHERE id=r.id;
  IF op.kind='sale' AND NOT EXISTS(SELECT 1 FROM business_receivables WHERE operation_id=op.id AND status='pending') THEN UPDATE business_operations SET status='completed' WHERE id=op.id; END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.close_business_operation(_operation_id uuid,_action text,_data jsonb,_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); op business_operations%rowtype; received numeric; refund numeric;
BEGIN
  IF uid IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  SELECT * INTO op FROM business_operations WHERE id=_operation_id AND user_id=uid FOR UPDATE;
  IF op.id IS NULL THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  IF _action='cancel' THEN
    IF op.status='cancelled' THEN RETURN; END IF;
    IF op.returned_at IS NOT NULL THEN RAISE EXCEPTION 'Locação já encerrada'; END IF;
    SELECT coalesce(sum(amount),0) INTO received FROM business_payments WHERE operation_id=op.id AND kind IN ('receipt','down_payment');
    IF received>0 THEN INSERT INTO business_payments(user_id,operation_id,kind,amount,method,request_id) VALUES(uid,op.id,'refund',received,coalesce(_data->>'method','pix'),_request_id); END IF;
    refund:=op.deposit-op.deposit_returned;
    IF refund>0 THEN INSERT INTO business_payments(user_id,operation_id,kind,amount,method,request_id) VALUES(uid,op.id,'deposit_refund',refund,coalesce(_data->>'method','pix'),gen_random_uuid()); END IF;
    UPDATE business_receivables SET status='cancelled' WHERE operation_id=op.id;
    UPDATE business_operations SET status='cancelled',deposit_returned=deposit,notes=notes||E'\nCancelamento: '||coalesce(_data->>'notes','') WHERE id=op.id;
  ELSIF _action='return' THEN
    IF op.kind<>'rental' OR op.status='cancelled' THEN RAISE EXCEPTION 'Locação inválida'; END IF;
    IF op.returned_at IS NOT NULL THEN RETURN; END IF;
    IF (_data->>'odometer')::numeric IS NULL OR (_data->>'odometer')::numeric<coalesce((op.details->>'odometer')::numeric,0) THEN RAISE EXCEPTION 'Quilometragem final inválida'; END IF;
    refund:=op.deposit-op.deposit_returned;
    IF refund>0 THEN INSERT INTO business_payments(user_id,operation_id,kind,amount,method,request_id) VALUES(uid,op.id,'deposit_refund',refund,coalesce(_data->>'method','pix'),_request_id); END IF;
    UPDATE business_operations SET status='completed',returned_at=now(),deposit_returned=deposit,details=details||jsonb_build_object('return',_data) WHERE id=op.id;
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  UPDATE business_assets SET status='available' WHERE id=op.asset_id AND user_id=uid;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(uid,_action,'business_operation',op.id,_data);
END $$;

CREATE FUNCTION public.record_business_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE op business_operations%rowtype;
BEGIN
  SELECT * INTO op FROM business_operations WHERE id=NEW.operation_id;
  INSERT INTO transactions(user_id,client_id,type,category,description,amount,date)
  VALUES(NEW.user_id,op.client_id,CASE WHEN NEW.kind IN ('deposit_refund','refund') THEN 'business_refund' WHEN NEW.kind='deposit' THEN 'security_deposit' ELSE 'business_income' END,
  CASE WHEN NEW.kind IN ('deposit','deposit_refund') THEN 'Caução' WHEN op.kind='sale' THEN 'Venda de celular' ELSE 'Locação de veículo' END,
  CASE NEW.kind WHEN 'deposit' THEN 'Caução recebida' WHEN 'deposit_refund' THEN 'Caução devolvida' WHEN 'refund' THEN 'Estorno de operação' ELSE 'Recebimento de operação' END||' · '||op.id::text,NEW.amount,NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER business_payment_ledger AFTER INSERT ON business_payments FOR EACH ROW EXECUTE FUNCTION record_business_ledger();

CREATE FUNCTION public.save_loan_collateral(_contract_id uuid,_data jsonb,_request_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cid uuid; result uuid;
BEGIN
  IF uid IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||_request_id::text,0));
  SELECT id INTO result FROM loan_collateral WHERE user_id=uid AND request_id=_request_id;IF result IS NOT NULL THEN RETURN result;END IF;
  SELECT client_id INTO cid FROM contracts WHERE id=_contract_id AND user_id=uid FOR UPDATE;
  IF cid IS NULL THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  INSERT INTO loan_collateral(user_id,client_id,contract_id,description,category,identifier,estimated_value,condition,storage_location,photos,notes,request_id)
  VALUES(uid,cid,_contract_id,_data->>'description',coalesce(_data->>'category','Outro'),coalesce(_data->>'identifier',''),(_data->>'estimated_value')::numeric,coalesce(_data->>'condition',''),coalesce(_data->>'storage_location',''),coalesce(_data->'photos','[]'),coalesce(_data->>'notes',''),_request_id) RETURNING id INTO result;
  RETURN result;
END $$;
CREATE FUNCTION public.return_loan_collateral(_id uuid,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item loan_collateral%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  SELECT * INTO item FROM loan_collateral WHERE id=_id AND user_id=auth.uid() FOR UPDATE;
  IF item.id IS NULL THEN RAISE EXCEPTION 'Garantia não encontrada'; END IF;
  IF item.status='returned' THEN RETURN; END IF;
  IF length(trim(coalesce(_note,'')))<3 THEN RAISE EXCEPTION 'Informe quem recebeu o bem e a observação de devolução'; END IF;
  UPDATE loan_collateral SET status='returned',returned_at=now(),return_note=_note WHERE id=item.id;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(auth.uid(),'return','loan_collateral',item.id,jsonb_build_object('note',_note));
END $$;
CREATE FUNCTION public.create_client_contract_with_collateral(_client_id uuid,_client jsonb,_contract jsonb,_installments jsonb,_collateral jsonb,_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; previous loan_collateral%rowtype;
BEGIN
  IF auth.uid() IS NULL OR _request_id IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||_request_id::text,0));
  SELECT * INTO previous FROM loan_collateral WHERE user_id=auth.uid() AND request_id=_request_id;
  IF previous.id IS NOT NULL THEN RETURN jsonb_build_object('client_id',previous.client_id,'contract_id',previous.contract_id,'installment_count',(SELECT count(*) FROM contract_installments WHERE contract_id=previous.contract_id)); END IF;
  result:=public.create_client_contract(_client_id,_client,_contract,_installments);
  PERFORM public.save_loan_collateral((result->>'contract_id')::uuid,_collateral,_request_id);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_business_asset(jsonb,uuid),public.create_business_operation(jsonb,uuid),public.receive_business_payment(uuid,numeric,text,uuid),public.close_business_operation(uuid,text,jsonb,uuid),public.save_loan_collateral(uuid,jsonb,uuid),public.return_loan_collateral(uuid,text),public.create_client_contract_with_collateral(uuid,jsonb,jsonb,jsonb,jsonb,uuid),public.record_business_ledger() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_business_asset(jsonb,uuid),public.create_business_operation(jsonb,uuid),public.receive_business_payment(uuid,numeric,text,uuid),public.close_business_operation(uuid,text,jsonb,uuid),public.save_loan_collateral(uuid,jsonb,uuid),public.return_loan_collateral(uuid,text),public.create_client_contract_with_collateral(uuid,jsonb,jsonb,jsonb,jsonb,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
