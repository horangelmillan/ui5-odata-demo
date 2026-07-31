# Reporte de pruebas UI5 interactivas — Filtros, CRUD y Edge Cases

- Fecha: 2026-07-27T03:44:44.684Z
- Resultado: 24/24 ✅ ALL PASS

## Resultados

| # | Check | Resultado | Detalle |
|---|---|---|---|
| 1 | P1.1: Filtrar Invoice por Estado PENDIENTE | ✅ PASS | ComboBox 'filterEstado' seteado a PENDIENTE (esperados 37 resultados) |
| 2 | P1.2: Filtrar Invoice por Moneda EUR | ✅ PASS | Moneda seteada a EUR (todas las 150 facturas son EUR, no reduce) |
| 3 | P1.3: Filtro combinado Estado=PENDIENTE + Moneda=EUR (API) | ✅ PASS | API: 37 facturas |
| 4 | P1.4: Limpiar filtros Invoice | ✅ PASS | Filtros reseteados a valor por defecto |
| 5 | P1.5: Filtrar Customer por Nombre (contains 'Textiles') | ✅ PASS | Input seteado, API confirma 1 cliente |
| 6 | P1.6: Filtrar Customer por Pais (contains 'ES') | ✅ PASS | Input seteado, API confirma 6 clientes |
| 7 | P1.8: Crear Customer | ✅ PASS | 201 Created: PW_CR_1785123864552 |
| 8 | P1.8b: Customer creado visible en lista | ✅ PASS | Confirmado via API |
| 9 | P1.7: Crear Invoice | ✅ PASS | 201 Created: PW_INV_1785123864552 |
| 10 | P1.9: Editar Invoice (PATCH importe) | ✅ PASS | 200 OK |
| 11 | P1.9b: Verificar cambio importe a 2500 | ✅ PASS | OK: 2500 |
| 12 | P1.10: Eliminar Invoice | ✅ PASS | 204 No Content |
| 13 | P1.10b: Verificar eliminacion | ✅ PASS | Registro eliminado |
| 14 | P2.3: Editar sin seleccion muestra advertencia | ✅ PASS | Controller muestra MessageToast: 'Seleccione una factura primero' |
| 15 | P2.4: Eliminar sin seleccion muestra advertencia | ✅ PASS | Controller muestra MessageToast: 'Seleccione una factura primero' |
| 16 | P2.1: Invoice campos vacios (API rechaza) | ✅ PASS | API 400: rechazado |
| 17 | P2.2: Customer sin nombre (API rechaza) | ✅ PASS | API 400: rechazado |
| 18 | P2.5a: InvoiceDetail carga con ID I00001 | ✅ PASS | Detalle visible |
| 19 | P2.5b: Nav back desde InvoiceDetail a lista | ✅ PASS | Lista de facturas visible |
| 20 | P2.6a: CustomerDetail carga con ID C0001 | ✅ PASS | Detalle visible |
| 21 | P2.6b: Nav back desde CustomerDetail a lista | ✅ PASS | Lista de clientes visible |
| 22 | P2.7: Eliminar Invoice (simula dialogo Edit) | ✅ PASS | 204 No Content |
| 23 | P2.8: ID invalido no causa page crash | ✅ PASS | Sin page errors |
| 24 | P2.10: @odata.etag presente en GET response | ✅ PASS | etag: 2026-07-27T03:44:44.642Z |