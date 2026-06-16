alter table public.client_services
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null;

update public.client_services service
set assignee_id = client.main_contact_id
from public.clients client
where service.client_id = client.id
  and service.assignee_id is null;

create index if not exists client_services_assignee_id_idx
  on public.client_services(assignee_id);
