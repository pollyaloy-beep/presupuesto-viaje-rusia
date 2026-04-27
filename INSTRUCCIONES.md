# 🚀 Instrucciones de Configuración - Presupuesto Rusia

Has exportado el proyecto con éxito. Sigue estos pasos para configurarlo en tu propio servidor y conectar tu base de datos de Supabase.

---

## 1. Configuración de Supabase (Base de Datos)
Para que la sincronización en tiempo real funcione con tu propia cuenta:

1. Crea un proyecto nuevo en [Supabase](https://supabase.com).
2. Ve a la sección **SQL Editor** y ejecuta el siguiente comando:

```sql
-- Crear tabla de salas/presupuestos
create table budget_rooms (
  id text primary key,
  expenses jsonb,
  updated_at timestamptz default now()
);

-- Habilitar tiempo real
alter publication supabase_realtime add table budget_rooms;

-- Políticas de seguridad (Acceso público para la demo)
alter table budget_rooms enable row level security;
create policy "Acceso Público" on budget_rooms for all using (true);
```

3. Ve a **Project Settings > API** y copia la `Project URL` y la `anon public` key.

---

## 2. Configurar la App
Abre el archivo `app.js` en tu editor de código y busca las primeras líneas. Puedes pegar tus llaves directamente ahí o introducirlas en la interfaz de la app (icono de la nube):

```javascript
// Si quieres dejarlas fijas, rellena estas constantes en app.js:
const SUPABASE_URL = "TU_URL_AQUÍ";
const SUPABASE_KEY = "TU_KEY_AQUÍ";
```

---

## 3. Despliegue en Easy Panel / Servidor Propio
Como es una aplicación estática (HTML/JS), no necesita Node.js ni bases de datos complejas en el servidor:

1. **Easy Panel**: Crea un servicio de tipo "Static Site".
2. **Archivos**: Sube (o conecta tu GitHub) los siguientes archivos:
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
3. **Dominio**: Configura tu dominio y asegúrate de que tenga **HTTPS** (necesario para que funcione como PWA e instalable en iPhone/Android).

---

## 4. Uso de la PWA
Para instalarla en el móvil:
- **iPhone**: Abre la URL en Safari -> Compartir -> "Añadir a la pantalla de inicio".
- **Android**: Abre en Chrome -> "Instalar aplicación".

---

### Notas de experto:
- La app funciona **Offline**. Si no hay red, guarda los cambios localmente y los subirá a Supabase en cuanto detecte conexión.
- El sistema de **fusión de datos** evita que se borren gastos si ambos escribís a la vez.

¡Buen viaje! 🎀🇷🇺
