CREATE OR REPLACE FUNCTION public.restore_user_backup_atomic(_user_id uuid, _dump jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _table text; _rows jsonb; _columns text; _updates text; _count integer;
  _counts jsonb := '{}'::jsonb;
  _allowed constant text[] := ARRAY[
    'clients','investors','collectors','vehicles','stock_items','settings','contracts',
    'investor_loans','rentals','goals','notes','todos','contract_installments',
    'investor_payments','transactions','expenses','profits','collector_assignments',
    'subscriptions','notifications','client_notifications','collection_attempts','audit_logs',
    'bot_actions_log','support_tickets','support_ticket_messages','whatsapp_conversations',
    'whatsapp_messages','whatsapp_notes','whatsapp_scheduled_messages','message_templates',
    'leads','pledges','ai_conversations','chat_channel_members','chat_messages',
    'chat_message_reactions','client_errors','user_roles'
  ];
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _user_id IS NULL OR _dump IS NULL OR jsonb_typeof(_dump) <> 'object' THEN RAISE EXCEPTION 'invalid_backup'; END IF;

  FOREACH _table IN ARRAY _allowed LOOP
    _rows := COALESCE(_dump -> _table, '[]'::jsonb);
    IF jsonb_typeof(_rows) <> 'array' THEN RAISE EXCEPTION 'invalid_table_payload:%', _table; END IF;
    IF _table = 'support_ticket_messages' THEN
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(_rows) row
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(_dump -> 'support_tickets', '[]'::jsonb)) ticket
          WHERE ticket ->> 'id' = row ->> 'ticket_id' AND ticket ->> 'user_id' = _user_id::text
        )
      ) THEN RAISE EXCEPTION 'backup_user_mismatch:%', _table; END IF;
    ELSIF EXISTS (
      SELECT 1 FROM jsonb_array_elements(_rows) row
      WHERE COALESCE(row ->> 'user_id', '') <> _user_id::text
    ) THEN RAISE EXCEPTION 'backup_user_mismatch:%', _table; END IF;

    _count := jsonb_array_length(_rows);
    IF _count > 0 THEN
      SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
             string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' ORDER BY a.attnum)
               FILTER (WHERE a.attname <> 'id')
      INTO _columns, _updates
      FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', _table)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
      EXECUTE format(
        'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) ON CONFLICT (id) DO UPDATE SET %3$s',
        _table, _columns, _updates
      ) USING _rows;
    END IF;
    _counts := _counts || jsonb_build_object(_table, _count);
  END LOOP;

  INSERT INTO public.audit_logs(user_id, entity_type, action, entity_id, details)
  VALUES (_user_id, 'backup', 'atomic_restore', NULL, jsonb_build_object('counts', _counts));
  RETURN jsonb_build_object('ok', true, 'counts', _counts);
END;
$$;

REVOKE ALL ON FUNCTION public.restore_user_backup_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_user_backup_atomic(uuid, jsonb) TO service_role;
