# Despliegue

El sitio es HTML/CSS/JS estático, sin paso de build. Se publica en dos sitios a la vez desde el mismo `git push origin main`:

## 1. GitHub Pages (ya activo)

Automático vía [.github/workflows/static.yml](.github/workflows/static.yml) en cada push a `main`.
URL: `https://mallenk.github.io/BarRestaurantAteneuUnio/`

## 2. Hostinger (dominio real)

### Intento 1: integración Git nativa de hPanel — descartado (bug)

hPanel → Avanzado → Git → Connect with GitHub debía bastar (Hostinger tira del repo por webhook, sin credenciales en el repo), pero la UI dio un bug al configurar el deploy y no se pudo completar. Queda documentado por si se prueba de nuevo más adelante, pero **el método activo es el de abajo**.

### Método activo: GitHub Actions + FTP

[.github/workflows/deploy-hostinger.yml](.github/workflows/deploy-hostinger.yml) sube los archivos por FTPS a `public_html` en cada push a `main`, usando [SamKirkland/FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action). No hay build: se sube el repo tal cual, igual que en GitHub Pages.

**Configuración (una sola vez):**

1. En hPanel: **Archivos → Cuentas FTP** → copiar el **Host/IP FTP**, el **usuario FTP** y la contraseña (o crear una cuenta FTP nueva con contraseña propia si prefieres no usar la principal).
2. En GitHub: repo `BarRestaurantAteneuUnio` → **Settings → Secrets and variables → Actions → New repository secret**, y crear estos tres, con los valores reales de Hostinger (nunca los pegues en el chat ni los escribas en el workflow):
   - `HOSTINGER_FTP_SERVER`
   - `HOSTINGER_FTP_USERNAME`
   - `HOSTINGER_FTP_PASSWORD`
3. Hacer push a `main` (o lanzar el workflow a mano desde la pestaña Actions → Deploy to Hostinger (FTP) → Run workflow) y revisar el log del job `ftp-deploy`.

Si el servidor de Hostinger rechaza `protocol: ftps`, cambiar a `ftp` en el workflow (algunos hosts compartidos no exponen FTPS explícito en el puerto 21).

## Pendiente antes de considerar Hostinger la fuente canónica

Ahora mismo `robots.txt`, `sitemap.xml`, las etiquetas Open Graph y el JSON-LD de `index.html` apuntan todos a `mallenk.github.io`. En cuanto el dominio de Hostinger esté activo hay que:

- Añadir `<link rel="canonical" href="https://<dominio-real>/">` en `index.html`.
- Actualizar `sitemap.xml`, la línea `Sitemap:` de `robots.txt`, y las URLs del JSON-LD (`@id`, `url`, `image`) al dominio real.
- Decidir cuál de los dos dominios es el canónico para Google — tener el mismo contenido en dos dominios sin canonicalizar diluye el SEO que estamos construyendo en el dossier.

## `/lab/`

El dashboard de skills se despliega también en Hostinger igual que en GitHub Pages (mismo repo, mismo tratamiento: `noindex` + `Disallow: /lab/`). Si no quieres que quede accesible en el dominio comercial real, es un cambio de un minuto — decidlo cuando tengas el dominio conectado.
