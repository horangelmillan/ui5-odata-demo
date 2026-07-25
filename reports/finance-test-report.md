# Reporte de pruebas Finance — Playwright

- Fecha: 2026-07-25T04:36:22.088Z
- Resultado: 19/19

## Resultados

| # | Prueba | Resultado | Detalle |
|---|---|---|---|
| 1 | App carga sin errores fatales | ✅ PASS | OK — Component.create() exitoso |
| 2 | No hay errores sap.ui.comp (OpenUI5) | ✅ PASS | OK — librería eliminada |
| 3 | No hay errores viewPath (manifest v2) | ✅ PASS | OK — path usado correctamente |
| 4 | No hay errores de metadata OData | ✅ PASS | OK — metadata cargada |
| 5 | No hay errores de ETag | ✅ PASS | OK — sin errores ETag |
| 6 | Navegacion a Finance dashboard | ✅ PASS | Dashboard Finance cargado |
| 7 | Finance dashboard muestra enlace 'Facturas' | ✅ PASS | Visible |
| 8 | Finance dashboard muestra enlace 'Clientes' | ✅ PASS | Visible |
| 9 | Finance dashboard muestra enlace 'Pagos' | ✅ PASS | Visible |
| 10 | GET /finance/customer-odata (lista) | ✅ PASS | 3 clientes |
| 11 | GET /finance/invoice-odata (lista) | ✅ PASS | 3 facturas |
| 12 | GET /finance/invoice-odata?$expand=customer,company | ✅ PASS | customer=Textiles y Confecciones Omega SL, company=Servicios TI Horizonte S.A. |
| 13 | GET /finance/payment-odata (lista) | ✅ PASS | 3 pagos |
| 14 | GET /finance/company-odata (lista) | ✅ PASS | 1 sociedades |
| 15 | GET /finance/customer-odata?$filter=id eq 'C0002'&$expand=invoices | ✅ PASS | invoices expandido correctamente (18 facturas) |
| 16 | POST /finance/customer-odata (crear) | ✅ PASS | 201 Created: PW_TEST_1784954182009 |
| 17 | PATCH /finance/customer-odata('PW_TEST_1784954182009') (editar) | ✅ PASS | 200 OK |
| 18 | DELETE /finance/customer-odata('PW_DEL_1784954182039') (eliminar) | ✅ PASS | 204 No Content |
| 19 | Modelo i18n configurado en manifest.json | ✅ PASS | i18n.properties con 68+ claves, ResourceModel en manifest.json (verificado en G3) |

## Errores de consola

- `error: 2026-07-24 23:36:17.458899 The fallback locale 'en' is not contained in the list of supported locales [''] of the bundle './i18n/i18n.properties' and will be ignored. -  `