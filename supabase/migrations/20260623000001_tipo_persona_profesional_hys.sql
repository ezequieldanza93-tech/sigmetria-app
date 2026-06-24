-- Renombrar tipo "Usuarios" a "Profesional H y S"
-- Este tipo identifica a personas del directorio vinculadas a cuentas de usuario.
-- Solo se crea automáticamente al crear/vincular una cuenta — no desde el directorio manual.
UPDATE personas_tipos
SET nombre = 'Profesional H y S'
WHERE id = 'd507bd22-6938-4dc3-b32b-761c606c51e6';

-- Agregar flag que bloquea la creación manual desde el formulario del directorio
ALTER TABLE personas_tipos
ADD COLUMN IF NOT EXISTS solo_via_cuenta boolean NOT NULL DEFAULT false;

UPDATE personas_tipos
SET solo_via_cuenta = true
WHERE id = 'd507bd22-6938-4dc3-b32b-761c606c51e6';
