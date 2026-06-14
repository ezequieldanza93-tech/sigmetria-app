-- Reorganización de checklists: grupo "Checklists" + 13 familias, limpieza de nombres y deduplicación
-- Generado el 2026-06-14. Eje EQUIPO/ACTIVIDAD (no toca tipos de riesgo).
do $$
declare
  g uuid;
  c1 uuid;
  c2 uuid;
  c3 uuid;
  c4 uuid;
  c5 uuid;
  c6 uuid;
  c7 uuid;
  c8 uuid;
  c9 uuid;
  c10 uuid;
  c11 uuid;
  c12 uuid;
  c13 uuid;
begin
  insert into gestiones_grupos (nombre) values ('Checklists') returning id into g;
  insert into gestiones_categorias (nombre, grupo_id) values ('Relevamientos Generales', g) returning id into c1;
  insert into gestiones_categorias (nombre, grupo_id) values ('Trabajos en Altura', g) returning id into c2;
  insert into gestiones_categorias (nombre, grupo_id) values ('Izaje y Aparejos', g) returning id into c3;
  insert into gestiones_categorias (nombre, grupo_id) values ('Aparatos a Presión y Soldadura', g) returning id into c4;
  insert into gestiones_categorias (nombre, grupo_id) values ('Máquinas y Herramientas', g) returning id into c5;
  insert into gestiones_categorias (nombre, grupo_id) values ('Maquinaria de Hormigón', g) returning id into c6;
  insert into gestiones_categorias (nombre, grupo_id) values ('Maquinaria Vial y Movimiento de Suelos', g) returning id into c7;
  insert into gestiones_categorias (nombre, grupo_id) values ('Vehículos y Autoelevadores', g) returning id into c8;
  insert into gestiones_categorias (nombre, grupo_id) values ('Instalaciones Eléctricas', g) returning id into c9;
  insert into gestiones_categorias (nombre, grupo_id) values ('Infraestructura de Obra', g) returning id into c10;
  insert into gestiones_categorias (nombre, grupo_id) values ('Seguridad y Emergencias', g) returning id into c11;
  insert into gestiones_categorias (nombre, grupo_id) values ('Gestión Documental y Control', g) returning id into c12;
  insert into gestiones_categorias (nombre, grupo_id) values ('Sustancias Químicas', g) returning id into c13;

  -- mover contenido de los nombres mojibake a la copia con nombre correcto
  update formularios_secciones set gestion_id = '5928a1e1-5d12-4674-84ba-48f14c0c7719' where gestion_id = '8cd55117-1437-4fb3-abe5-4ac62b4a9d0c';
  update formularios_secciones set gestion_id = '306693ac-57ec-42c4-8a65-971a2e667c13' where gestion_id = '85458d60-80b8-4e77-b882-3ca8aa66ce5a';

  -- borrar duplicados (children primero por FK)
  delete from formularios_respuestas where gestion_id in ('1a89ce92-d7ee-49e5-8853-dcd56e5c484a', 'e28f1a64-b2aa-4e2e-839a-959b4c33d404', '194aaf5d-820c-4eb6-8031-6e41e4503109', '9a6581b7-972b-451b-9bf4-d2c5c3b4c96f', 'c2fa809f-f332-4623-bf2a-7e24abc14224', 'ec7a7088-e464-4a97-9979-bbe5fa3dd531', '22e4537d-4f97-44f5-b402-5832ad258196', 'faa28fc1-aadd-438f-8a00-9de1909d3f88', '22c7c3aa-285a-42e0-8681-e2b2e7e16877', '8cd55117-1437-4fb3-abe5-4ac62b4a9d0c', '85458d60-80b8-4e77-b882-3ca8aa66ce5a', '0aa84dda-3c5d-4c76-b044-25ce057f5fb6', '4f465c07-b028-446b-b309-06fd4c8729b8', '57509a9a-5c5e-4448-be89-539fb864403f', '877898e9-e1f7-46cd-812d-c36254010228', 'b7cc673e-ac84-434b-a964-252e9acf6cf5', 'f7168361-36dd-4b39-adcf-f4d9ac7abf84', 'db94103c-7e3d-4801-8546-f6eedbf368c8', '377d5302-dde9-467d-be5e-9ce97d9f4ec3', '6c57ee07-674e-4e41-9f0f-fb43d13d495e', 'acfaa095-8d30-4dc6-a6cd-9c62d9b9a7bd', '05c597c8-40fa-453e-bb24-8bd32a4569c3', '4701ea2e-f785-458d-994a-b74f67e53f2b', 'e7f95639-e375-4148-bb7a-bf4c81f79a6a', '836c2a01-9cb9-4fbc-bc17-42a82ceed938');
  delete from formularios_secciones where gestion_id in ('1a89ce92-d7ee-49e5-8853-dcd56e5c484a', 'e28f1a64-b2aa-4e2e-839a-959b4c33d404', '194aaf5d-820c-4eb6-8031-6e41e4503109', '9a6581b7-972b-451b-9bf4-d2c5c3b4c96f', 'c2fa809f-f332-4623-bf2a-7e24abc14224', 'ec7a7088-e464-4a97-9979-bbe5fa3dd531', '22e4537d-4f97-44f5-b402-5832ad258196', 'faa28fc1-aadd-438f-8a00-9de1909d3f88', '22c7c3aa-285a-42e0-8681-e2b2e7e16877', '8cd55117-1437-4fb3-abe5-4ac62b4a9d0c', '85458d60-80b8-4e77-b882-3ca8aa66ce5a', '0aa84dda-3c5d-4c76-b044-25ce057f5fb6', '4f465c07-b028-446b-b309-06fd4c8729b8', '57509a9a-5c5e-4448-be89-539fb864403f', '877898e9-e1f7-46cd-812d-c36254010228', 'b7cc673e-ac84-434b-a964-252e9acf6cf5', 'f7168361-36dd-4b39-adcf-f4d9ac7abf84', 'db94103c-7e3d-4801-8546-f6eedbf368c8', '377d5302-dde9-467d-be5e-9ce97d9f4ec3', '6c57ee07-674e-4e41-9f0f-fb43d13d495e', 'acfaa095-8d30-4dc6-a6cd-9c62d9b9a7bd', '05c597c8-40fa-453e-bb24-8bd32a4569c3', '4701ea2e-f785-458d-994a-b74f67e53f2b', 'e7f95639-e375-4148-bb7a-bf4c81f79a6a', '836c2a01-9cb9-4fbc-bc17-42a82ceed938');
  delete from gestiones_establecimientos where gestion_id in ('1a89ce92-d7ee-49e5-8853-dcd56e5c484a', 'e28f1a64-b2aa-4e2e-839a-959b4c33d404', '194aaf5d-820c-4eb6-8031-6e41e4503109', '9a6581b7-972b-451b-9bf4-d2c5c3b4c96f', 'c2fa809f-f332-4623-bf2a-7e24abc14224', 'ec7a7088-e464-4a97-9979-bbe5fa3dd531', '22e4537d-4f97-44f5-b402-5832ad258196', 'faa28fc1-aadd-438f-8a00-9de1909d3f88', '22c7c3aa-285a-42e0-8681-e2b2e7e16877', '8cd55117-1437-4fb3-abe5-4ac62b4a9d0c', '85458d60-80b8-4e77-b882-3ca8aa66ce5a', '0aa84dda-3c5d-4c76-b044-25ce057f5fb6', '4f465c07-b028-446b-b309-06fd4c8729b8', '57509a9a-5c5e-4448-be89-539fb864403f', '877898e9-e1f7-46cd-812d-c36254010228', 'b7cc673e-ac84-434b-a964-252e9acf6cf5', 'f7168361-36dd-4b39-adcf-f4d9ac7abf84', 'db94103c-7e3d-4801-8546-f6eedbf368c8', '377d5302-dde9-467d-be5e-9ce97d9f4ec3', '6c57ee07-674e-4e41-9f0f-fb43d13d495e', 'acfaa095-8d30-4dc6-a6cd-9c62d9b9a7bd', '05c597c8-40fa-453e-bb24-8bd32a4569c3', '4701ea2e-f785-458d-994a-b74f67e53f2b', 'e7f95639-e375-4148-bb7a-bf4c81f79a6a', '836c2a01-9cb9-4fbc-bc17-42a82ceed938');
  delete from gestiones_tipos_establecimiento where gestion_id in ('1a89ce92-d7ee-49e5-8853-dcd56e5c484a', 'e28f1a64-b2aa-4e2e-839a-959b4c33d404', '194aaf5d-820c-4eb6-8031-6e41e4503109', '9a6581b7-972b-451b-9bf4-d2c5c3b4c96f', 'c2fa809f-f332-4623-bf2a-7e24abc14224', 'ec7a7088-e464-4a97-9979-bbe5fa3dd531', '22e4537d-4f97-44f5-b402-5832ad258196', 'faa28fc1-aadd-438f-8a00-9de1909d3f88', '22c7c3aa-285a-42e0-8681-e2b2e7e16877', '8cd55117-1437-4fb3-abe5-4ac62b4a9d0c', '85458d60-80b8-4e77-b882-3ca8aa66ce5a', '0aa84dda-3c5d-4c76-b044-25ce057f5fb6', '4f465c07-b028-446b-b309-06fd4c8729b8', '57509a9a-5c5e-4448-be89-539fb864403f', '877898e9-e1f7-46cd-812d-c36254010228', 'b7cc673e-ac84-434b-a964-252e9acf6cf5', 'f7168361-36dd-4b39-adcf-f4d9ac7abf84', 'db94103c-7e3d-4801-8546-f6eedbf368c8', '377d5302-dde9-467d-be5e-9ce97d9f4ec3', '6c57ee07-674e-4e41-9f0f-fb43d13d495e', 'acfaa095-8d30-4dc6-a6cd-9c62d9b9a7bd', '05c597c8-40fa-453e-bb24-8bd32a4569c3', '4701ea2e-f785-458d-994a-b74f67e53f2b', 'e7f95639-e375-4148-bb7a-bf4c81f79a6a', '836c2a01-9cb9-4fbc-bc17-42a82ceed938');
  delete from gestiones where id in ('1a89ce92-d7ee-49e5-8853-dcd56e5c484a', 'e28f1a64-b2aa-4e2e-839a-959b4c33d404', '194aaf5d-820c-4eb6-8031-6e41e4503109', '9a6581b7-972b-451b-9bf4-d2c5c3b4c96f', 'c2fa809f-f332-4623-bf2a-7e24abc14224', 'ec7a7088-e464-4a97-9979-bbe5fa3dd531', '22e4537d-4f97-44f5-b402-5832ad258196', 'faa28fc1-aadd-438f-8a00-9de1909d3f88', '22c7c3aa-285a-42e0-8681-e2b2e7e16877', '8cd55117-1437-4fb3-abe5-4ac62b4a9d0c', '85458d60-80b8-4e77-b882-3ca8aa66ce5a', '0aa84dda-3c5d-4c76-b044-25ce057f5fb6', '4f465c07-b028-446b-b309-06fd4c8729b8', '57509a9a-5c5e-4448-be89-539fb864403f', '877898e9-e1f7-46cd-812d-c36254010228', 'b7cc673e-ac84-434b-a964-252e9acf6cf5', 'f7168361-36dd-4b39-adcf-f4d9ac7abf84', 'db94103c-7e3d-4801-8546-f6eedbf368c8', '377d5302-dde9-467d-be5e-9ce97d9f4ec3', '6c57ee07-674e-4e41-9f0f-fb43d13d495e', 'acfaa095-8d30-4dc6-a6cd-9c62d9b9a7bd', '05c597c8-40fa-453e-bb24-8bd32a4569c3', '4701ea2e-f785-458d-994a-b74f67e53f2b', 'e7f95639-e375-4148-bb7a-bf4c81f79a6a', '836c2a01-9cb9-4fbc-bc17-42a82ceed938');

  -- limpiar nombres y reasignar cada checklist a su familia
  update gestiones set categoria_id = c1, nombre = case id
    when '90d64950-47cf-402e-91bf-2ea5bbd5eac6' then 'Administración y Comercios'
    when '2158f25e-fbbf-4e3b-bff9-28db383cde88' then 'Agro'
    when 'ff65a584-f923-455e-b848-81ac4882e58b' then 'Acta de Inspección Ministerio de Trabajo (Dec. 351/79)'
    when '41ce98d3-b8b6-4cfb-a949-9774a885ffbc' then 'Relevamiento General de Industria'
    when '519f134f-d20e-46ba-b9dd-483efad6a8e1' then 'Relevamiento General de Obra'
    when '75abff04-c620-4812-9c43-86cad1806a62' then 'Visita de Locales'
    when 'aaf01cba-340e-4891-8496-c59961050198' then 'Estándares del Sitio'
    when '901b7ead-e1f8-4d10-8f1b-44f30633bf82' then 'Inicio de Obra'
  end
  where id in ('90d64950-47cf-402e-91bf-2ea5bbd5eac6', '2158f25e-fbbf-4e3b-bff9-28db383cde88', 'ff65a584-f923-455e-b848-81ac4882e58b', '41ce98d3-b8b6-4cfb-a949-9774a885ffbc', '519f134f-d20e-46ba-b9dd-483efad6a8e1', '75abff04-c620-4812-9c43-86cad1806a62', 'aaf01cba-340e-4891-8496-c59961050198', '901b7ead-e1f8-4d10-8f1b-44f30633bf82');
  update gestiones set categoria_id = c2, nombre = case id
    when 'd6717056-92f0-48bd-95aa-1ddb90c716ae' then 'Andamios'
    when '4a0bf974-35d0-4e7d-8610-ce9c6738c50a' then 'Arneses y Líneas de Vida'
    when '9d7cd65c-799a-4177-95fe-15f45df40ac0' then 'Escaleras Manuales'
    when '819d1ddc-8bfb-4860-8daf-1f7e00dba04a' then 'Trabajos en Altura'
    when 'bca50417-f78e-4109-9d57-ceb47c6d8cca' then 'Andamios Colgantes'
    when '5ceb1b81-077f-4d53-a694-f7c29c6de2a1' then 'Andamios Fijos/Móviles'
    when 'b4f29d04-0eb2-4639-b997-200b26bef63c' then 'PEMP (Plataformas Elevadoras Móviles de Personas)'
    when '3bbbfe62-310a-4761-ba98-0dd431ab6093' then 'Silleta'
    when 'df32dd54-e8d4-423e-8942-dbf419048d41' then 'Sistema de Arresto de Caídas'
    when '545d4d87-cb41-45cc-a4c6-a4f153dbcb6e' then 'Trabajos en Poste'
  end
  where id in ('d6717056-92f0-48bd-95aa-1ddb90c716ae', '4a0bf974-35d0-4e7d-8610-ce9c6738c50a', '9d7cd65c-799a-4177-95fe-15f45df40ac0', '819d1ddc-8bfb-4860-8daf-1f7e00dba04a', 'bca50417-f78e-4109-9d57-ceb47c6d8cca', '5ceb1b81-077f-4d53-a694-f7c29c6de2a1', 'b4f29d04-0eb2-4639-b997-200b26bef63c', '3bbbfe62-310a-4761-ba98-0dd431ab6093', 'df32dd54-e8d4-423e-8942-dbf419048d41', '545d4d87-cb41-45cc-a4c6-a4f153dbcb6e');
  update gestiones set categoria_id = c3, nombre = case id
    when 'ee41a12b-53df-4f9a-acf0-1123e9aba26a' then 'Elementos de Izaje'
    when '816a7f90-4edb-4fbe-bf88-5daf3bce0aaf' then 'Grúa Móvil'
    when 'fb1b197a-1beb-467d-99ca-9b236b48cb30' then 'Grúa Torre'
    when '0cc740b6-ec31-473e-92eb-5f1b15a27d5f' then 'Hidrogrúa'
    when '2c952e4b-6ca4-4669-9b07-d620b8243ee5' then 'Malacate Manual'
    when '0fc15ea0-29e1-45bc-a653-b58df5b45e22' then 'Motor Guinche'
    when '4069570f-1fd1-4d01-a3dd-8884e8a68a10' then 'Cables de Acero'
    when '48d007d4-51da-4292-b5b6-86ee086091e0' then 'Cáncamos'
    when 'cc7fc624-e283-4eda-9544-cef4c387e046' then 'Eslingas'
    when '5bb0ab91-bb65-4f2b-b91f-2ed6b31474da' then 'Ganchos'
    when '7558177e-ca4c-44f5-93fd-7b8e90c56a5f' then 'Grilletes'
    when '81170d88-9afc-4d95-9d94-66c55f8c4a78' then 'Pestal'
    when 'beb87761-7143-48b5-994b-94787bfa5716' then 'Izaje de Cargas'
    when '04c3c4d9-2a8d-4e89-bed2-4507ebcf81b1' then 'Canasto para Izaje'
    when 'f77675e7-023f-486c-9dc1-9f35a05938d8' then 'Cuchara para Izaje'
  end
  where id in ('ee41a12b-53df-4f9a-acf0-1123e9aba26a', '816a7f90-4edb-4fbe-bf88-5daf3bce0aaf', 'fb1b197a-1beb-467d-99ca-9b236b48cb30', '0cc740b6-ec31-473e-92eb-5f1b15a27d5f', '2c952e4b-6ca4-4669-9b07-d620b8243ee5', '0fc15ea0-29e1-45bc-a653-b58df5b45e22', '4069570f-1fd1-4d01-a3dd-8884e8a68a10', '48d007d4-51da-4292-b5b6-86ee086091e0', 'cc7fc624-e283-4eda-9544-cef4c387e046', '5bb0ab91-bb65-4f2b-b91f-2ed6b31474da', '7558177e-ca4c-44f5-93fd-7b8e90c56a5f', '81170d88-9afc-4d95-9d94-66c55f8c4a78', 'beb87761-7143-48b5-994b-94787bfa5716', '04c3c4d9-2a8d-4e89-bed2-4507ebcf81b1', 'f77675e7-023f-486c-9dc1-9f35a05938d8');
  update gestiones set categoria_id = c4, nombre = case id
    when '7bcad87b-5808-4e8a-a37b-f66fb0a4651a' then 'Aparatos Sometidos a Presión'
    when '5928a1e1-5d12-4674-84ba-48f14c0c7719' then 'Cilindros a Presión'
    when '306a4bf8-29bf-4632-bf95-5f0581b2c5b6' then 'Cizalla y Dobladora'
    when '364abcac-9765-40e8-beaf-b69b0a367f96' then 'Compresor'
    when '3ba2f01b-5b64-44eb-b5d1-96cbb28fd0d8' then 'Esmeril Angular'
    when '93028929-6eef-4221-94a1-404047559017' then 'Soldadura Eléctrica'
    when '707ae485-bda4-4c18-86c3-d2dd2da7627d' then 'Soldadura Oxi-Acetilénica'
  end
  where id in ('7bcad87b-5808-4e8a-a37b-f66fb0a4651a', '5928a1e1-5d12-4674-84ba-48f14c0c7719', '306a4bf8-29bf-4632-bf95-5f0581b2c5b6', '364abcac-9765-40e8-beaf-b69b0a367f96', '3ba2f01b-5b64-44eb-b5d1-96cbb28fd0d8', '93028929-6eef-4221-94a1-404047559017', '707ae485-bda4-4c18-86c3-d2dd2da7627d');
  update gestiones set categoria_id = c5, nombre = case id
    when '136d4eae-7f5a-4858-b296-e282218776eb' then 'Amoladora de Banco'
    when '6c1e7fd1-e985-452c-b817-20e9b68acd4c' then 'Amoladora Portátil'
    when '343d53d3-5c2c-48f1-9491-ae725a5263c6' then 'Martillo Eléctrico Demoledor'
    when '84645166-52fc-479b-89ce-d6c8589ba9b5' then 'Sierra Circular'
    when 'c298c725-3b0c-4196-8d4b-457fd727f0d7' then 'Sierra Sensitiva'
    when '35196c1d-01a5-4806-a869-832f252aaf5a' then 'Soldadora Eléctrica'
    when '0b1a40e7-c4ed-462a-bfb9-cdcab0ac34d4' then 'Taladro / Rotopercutor'
    when '3c0fa85a-7dff-4349-ae7d-d0a66f85e722' then 'Máquinas, Herramientas y Equipos'
  end
  where id in ('136d4eae-7f5a-4858-b296-e282218776eb', '6c1e7fd1-e985-452c-b817-20e9b68acd4c', '343d53d3-5c2c-48f1-9491-ae725a5263c6', '84645166-52fc-479b-89ce-d6c8589ba9b5', 'c298c725-3b0c-4196-8d4b-457fd727f0d7', '35196c1d-01a5-4806-a869-832f252aaf5a', '0b1a40e7-c4ed-462a-bfb9-cdcab0ac34d4', '3c0fa85a-7dff-4349-ae7d-d0a66f85e722');
  update gestiones set categoria_id = c6, nombre = case id
    when 'e310e99b-44b5-4614-9aec-018b3d70c2ce' then 'Bomba de Hormigón'
    when '69ac78fa-63a2-441d-8ae4-cea6218ae2ac' then 'Camión Mixer'
    when '75a1f578-5ee3-4cb4-8007-edb074618803' then 'Cortadora de Hierro'
    when 'cce725de-1a05-4e14-af40-eb671a41d006' then 'Dobladora de Hierro'
    when 'ea5a56f3-e320-4f0b-ab3c-d82d9f87c281' then 'Hormigonera'
    when 'fca20e25-d21f-4c08-9da5-8cbf1886683a' then 'Pluma Distribuidora de Hormigón'
    when '7e3e344f-00ba-45d0-b411-8136ce4aa8f7' then 'Vibrador Eléctrico'
  end
  where id in ('e310e99b-44b5-4614-9aec-018b3d70c2ce', '69ac78fa-63a2-441d-8ae4-cea6218ae2ac', '75a1f578-5ee3-4cb4-8007-edb074618803', 'cce725de-1a05-4e14-af40-eb671a41d006', 'ea5a56f3-e320-4f0b-ab3c-d82d9f87c281', 'fca20e25-d21f-4c08-9da5-8cbf1886683a', '7e3e344f-00ba-45d0-b411-8136ce4aa8f7');
  update gestiones set categoria_id = c7, nombre = case id
    when 'f5097624-fb75-40c0-b521-7815d7bbc6a0' then 'Demolición'
    when 'd81ded93-bbd7-4bed-84c0-d6c0a9b56c1c' then 'Excavación'
    when '70205a38-d92a-48b4-a012-09a3bf4b3721' then 'Limpieza de Terreno'
    when 'f52df43e-f900-4a8d-bd05-4f6e14605c52' then 'Llenado de Platea'
    when 'a7337455-c4ad-481b-8264-da98684619c3' then 'Submuración'
    when '08509a0a-de85-4704-bb37-968d49a83a3c' then 'Camión Volcador'
    when '0eb712d8-c6fc-40c2-815f-ee2d5725172c' then 'Cargadora Frontal'
    when '0f180fd3-dd7f-44c6-a0ac-acdd0851972b' then 'Excavadora'
    when 'c8495f22-968b-48ce-9c56-d97fff6e354d' then 'Motoniveladora'
    when '367722ea-7289-4e82-9cb1-7659ecca7d0d' then 'Retroexcavadora'
    when '716110ce-446c-40a7-a0b5-403b40a5119e' then 'Rodillo Compactador'
  end
  where id in ('f5097624-fb75-40c0-b521-7815d7bbc6a0', 'd81ded93-bbd7-4bed-84c0-d6c0a9b56c1c', '70205a38-d92a-48b4-a012-09a3bf4b3721', 'f52df43e-f900-4a8d-bd05-4f6e14605c52', 'a7337455-c4ad-481b-8264-da98684619c3', '08509a0a-de85-4704-bb37-968d49a83a3c', '0eb712d8-c6fc-40c2-815f-ee2d5725172c', '0f180fd3-dd7f-44c6-a0ac-acdd0851972b', 'c8495f22-968b-48ce-9c56-d97fff6e354d', '367722ea-7289-4e82-9cb1-7659ecca7d0d', '716110ce-446c-40a7-a0b5-403b40a5119e');
  update gestiones set categoria_id = c8, nombre = case id
    when 'd836a887-8e47-42f6-abb6-781da2909855' then 'Vehículos Livianos'
    when '810271f2-9895-40c0-9aeb-6fa98404a03e' then 'Autoelevadores'
  end
  where id in ('d836a887-8e47-42f6-abb6-781da2909855', '810271f2-9895-40c0-9aeb-6fa98404a03e');
  update gestiones set categoria_id = c9, nombre = case id
    when 'ea172eda-270d-4a5e-ae18-f1860dd41f0c' then 'Instalaciones Eléctricas'
    when 'bb715fbe-a1f2-4ffc-baaa-9f159e5c55f2' then 'Generador Eléctrico'
    when '0e93c123-02d1-44e8-8e7d-b4f13e71ee32' then 'Tablero Eléctrico'
    when '1905777e-3835-4fd9-bb56-89f2543eb3bd' then 'Grupo Electrógeno'
  end
  where id in ('ea172eda-270d-4a5e-ae18-f1860dd41f0c', 'bb715fbe-a1f2-4ffc-baaa-9f159e5c55f2', '0e93c123-02d1-44e8-8e7d-b4f13e71ee32', '1905777e-3835-4fd9-bb56-89f2543eb3bd');
  update gestiones set categoria_id = c10, nombre = case id
    when '7ab6922c-eea5-4e84-bd2f-8dedbd1b73f7' then 'Acopio de Tierras y Escombros'
    when 'c16a37d0-fcba-4334-ad42-4e817f95742e' then 'Almacenamiento'
    when '85e3df3e-50b6-4dfe-9693-ebafca6eb5fc' then 'Almacenamiento de Residuos'
    when 'c5326552-9247-4353-ab7a-aa10851c2de5' then 'Baños Químicos'
    when 'f81afd09-fab3-4366-8aaa-409f2c3ef27e' then 'Bienestar Sereno'
    when '746d8d2f-e9fc-478e-be53-da82fd7c327e' then 'Comedor'
    when '014aea09-d3a4-45fb-813d-80d8453d5a2a' then 'Control de Acceso'
    when '3362c998-9659-4bcf-a0cd-222ae906dd44' then 'Depósito de Aparatos a Presión'
    when '86f86d4c-f5d6-42cd-9939-6d3ed8eb8ca7' then 'Depósito de Inflamables'
    when 'e44e30d0-4ea2-4967-8fb2-dcad7787d73b' then 'Oficina de Jefatura'
    when 'de3d5395-85d5-4d35-a756-5f96864c60ea' then 'Oficinas'
    when '98c904c4-a3ba-4b0f-9f59-a3c2f2ee7950' then 'Pañol'
    when 'ebd6268d-a22e-4969-843a-042a52fbc60d' then 'Servicios Sanitarios'
    when 'ff56e710-d32d-4663-8973-4fa8c45966e0' then 'Vestuarios'
    when 'b349adc9-9261-428a-aa86-cce233c70d48' then 'Zona de Acopio de Materiales'
  end
  where id in ('7ab6922c-eea5-4e84-bd2f-8dedbd1b73f7', 'c16a37d0-fcba-4334-ad42-4e817f95742e', '85e3df3e-50b6-4dfe-9693-ebafca6eb5fc', 'c5326552-9247-4353-ab7a-aa10851c2de5', 'f81afd09-fab3-4366-8aaa-409f2c3ef27e', '746d8d2f-e9fc-478e-be53-da82fd7c327e', '014aea09-d3a4-45fb-813d-80d8453d5a2a', '3362c998-9659-4bcf-a0cd-222ae906dd44', '86f86d4c-f5d6-42cd-9939-6d3ed8eb8ca7', 'e44e30d0-4ea2-4967-8fb2-dcad7787d73b', 'de3d5395-85d5-4d35-a756-5f96864c60ea', '98c904c4-a3ba-4b0f-9f59-a3c2f2ee7950', 'ebd6268d-a22e-4969-843a-042a52fbc60d', 'ff56e710-d32d-4663-8973-4fa8c45966e0', 'b349adc9-9261-428a-aa86-cce233c70d48');
  update gestiones set categoria_id = c11, nombre = case id
    when '4f7e337f-ccd6-4cf1-9756-32fb158634fd' then 'Clasificación de Residuos'
    when '1912f311-e725-4edd-adb3-79d8db66c0a2' then 'Elementos de Seguridad'
    when '3c447381-e18b-457c-8f61-9bc3f38a9fbe' then 'Extintores'
    when '306693ac-57ec-42c4-8a65-971a2e667c13' then 'Señalética de Obra'
    when '7ecc75b2-7797-4117-ba5f-30ec9d2e2b94' then 'Señalética Vial'
    when '97fa9d8c-ed6f-46b9-94bb-21e910788643' then 'Red de Incendio'
    when '85e46e00-a76e-4b5b-bbae-37f18ce74919' then 'Botiquín'
  end
  where id in ('4f7e337f-ccd6-4cf1-9756-32fb158634fd', '1912f311-e725-4edd-adb3-79d8db66c0a2', '3c447381-e18b-457c-8f61-9bc3f38a9fbe', '306693ac-57ec-42c4-8a65-971a2e667c13', '7ecc75b2-7797-4117-ba5f-30ec9d2e2b94', '97fa9d8c-ed6f-46b9-94bb-21e910788643', '85e46e00-a76e-4b5b-bbae-37f18ce74919');
  update gestiones set categoria_id = c12, nombre = case id
    when '292d1677-67df-4730-b0d3-0e4acfdfdd04' then 'Control de Contratistas'
    when '56542862-8653-4477-a894-2b69a0362d5f' then 'Control de EPP'
    when '5085c180-85e2-4a8e-9349-e4a034d51e33' then 'Documentación'
    when 'b108ad4d-8737-45be-b3e4-5d31cc143893' then 'Orden y Limpieza'
  end
  where id in ('292d1677-67df-4730-b0d3-0e4acfdfdd04', '56542862-8653-4477-a894-2b69a0362d5f', '5085c180-85e2-4a8e-9349-e4a034d51e33', 'b108ad4d-8737-45be-b3e4-5d31cc143893');
  update gestiones set categoria_id = c13, nombre = case id
    when 'de70bdd7-f160-4420-bc46-aa57dde95e02' then 'Sustancias Químicas'
  end
  where id in ('de70bdd7-f160-4420-bc46-aa57dde95e02');

  -- borrar la vieja categoría "Checklists" (ahora vacía)
  delete from gestiones_categorias c using gestiones_grupos gg
   where c.grupo_id = gg.id and gg.nombre = 'Controles Operativos' and c.nombre = 'Checklists';
end $$;
