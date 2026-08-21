insert into public.branches(name,slug) values
('Marabá','maraba'),('Manaus','manaus'),('São Luís','sao-luis'),('Marituba','marituba'),('Miritituba','miritituba'),('Balsas','balsas'),('Imperatriz','imperatriz'),('Itaitinga','itaitinga'),('Teresina','teresina') on conflict(name) do nothing;

insert into public.app_users(matricula,full_name,role) values
('4629','Tiago do Vale Gomes','consultor'),('4846','Lana Freitas','consultor'),('19115','Vinicius Veloso','consultor'),('44031','Alex Barbosa','consultor'),('4595','Thauana Mattos','consultor'),('19103','Hamilton Matias','gestor'),('44033','Delmiro Neto','gestor'),('19124','Alisson Mafra','admin')
on conflict(matricula) do update set full_name=excluded.full_name,role=excluded.role,active=true;

insert into public.user_branches(user_id,branch_id) select u.id,b.id from public.app_users u join public.branches b on b.name in ('Marabá','Manaus') where u.matricula='4629' on conflict do nothing;
insert into public.user_branches(user_id,branch_id) select u.id,b.id from public.app_users u join public.branches b on b.name='São Luís' where u.matricula='4846' on conflict do nothing;
insert into public.user_branches(user_id,branch_id) select u.id,b.id from public.app_users u join public.branches b on b.name in ('Marituba','Miritituba') where u.matricula='19115' on conflict do nothing;
insert into public.user_branches(user_id,branch_id) select u.id,b.id from public.app_users u join public.branches b on b.name in ('Balsas','Imperatriz') where u.matricula='44031' on conflict do nothing;
insert into public.user_branches(user_id,branch_id) select u.id,b.id from public.app_users u join public.branches b on b.name in ('Itaitinga','Teresina') where u.matricula='4595' on conflict do nothing;

insert into public.appointment_statuses(name,color_hex,text_color,sort_order) values
('Garantia','#00B050','#FFFFFF',1),('Férias','#FF0000','#FFFFFF',2),('Aplicação de peças','#ED7D31','#111827',3),('Medição material rodante','#FF6699','#111827',4),('Oficina','#92D050','#111827',5),('Manutenção carro','#DDEBF7','#111827',6),('Diagnóstico','#000000','#FFFFFF',7),('Entrega Técnica','#FFFF00','#111827',8),('Revisão PMP','#00B0F0','#111827',9),('Revisão OS cliente','#A02B93','#FFFFFF',10),('Equipamento parado','#F4B4D0','#111827',11),('Deslocamento garantia','#FFC000','#111827',12),('Deslocamento cliente','#002060','#FFFFFF',13),('Deslocamento PMP','#7030A0','#FFFFFF',14),('Folga','#C00000','#FFFFFF',15),('Sem agenda','#008000','#FFFFFF',16),('Treinamento','#0070C0','#FFFFFF',17)
on conflict(name) do update set color_hex=excluded.color_hex,text_color=excluded.text_color,sort_order=excluded.sort_order,active=true;

insert into public.technicians(branch_id,name) select id,'Frank Martins' from public.branches where name='Marituba' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Italo Sousa' from public.branches where name='Marituba' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Cezaro Augusto' from public.branches where name='Marituba' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Francisco Lobo' from public.branches where name='Marituba' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Marky Franklin' from public.branches where name='Marituba' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Leurys Nunes' from public.branches where name='Manaus' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Maison Pereira' from public.branches where name='Manaus' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Victor Martins' from public.branches where name='Marabá' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Igor Geovane' from public.branches where name='Marabá' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Antonio Roque' from public.branches where name='Marabá' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Anderson Acelino' from public.branches where name='Teresina' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Miguel Santos' from public.branches where name='Itaitinga' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Rick Brito' from public.branches where name='Itaitinga' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Almivar Lucena' from public.branches where name='Imperatriz' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Jonas Lopes' from public.branches where name='Balsas' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Yuri' from public.branches where name='São Luís' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Vitor' from public.branches where name='São Luís' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Isaque' from public.branches where name='São Luís' on conflict do nothing;
insert into public.technicians(branch_id,name) select id,'Henrique' from public.branches where name='São Luís' on conflict do nothing;
