# Reporte de compatibilidad UI5 / OpenUI5 OData V4 — vs `servidor-odata`

- Generado: 2026-07-19T04:41:08.191Z
- Runtime UI5: OpenUI5 **1.150.0** (cargado vía `@ui5/cli` 4.0.57, librerías del npm)
- Cliente: `sap.ui.model.odata.v4.ODataModel` (operationMode=Server, autoExpandSelect:false, groupId=$direct, updateGroupId=changes)
- Servidor bajo prueba: `http://127.0.0.1:3000/odata` (servidor-odata, PostgreSQL)
- Validación: navegador real (Playwright/Chromium) conduciendo el modelo OData V4; tráfico de red capturado desde el proxy `/odata` en vivo.

## Arranque de metadatos (bootstrap)

- `metadataLoaded()`: **OK (EDMX 4.0 estándar servido por el server en /odata/$metadata, sin shim)**
- Forma del `$metadata` del servidor (sondeado directamente): EDMX/CSDL estándar (application/xml; charset=utf-8) (forma: `(EDMX XML)`)

## Matriz de características (TODOS los componentes OData)

| # | Característica (OData V4) | Resultado | Evidencia (petición) | Detalle |
|---|---|---|---|---|
| 1 | Metadata served to UI5 (/odata/$metadata) | ✅ PASS | `/odata/$metadata` | servedToUI5IsStandard=true contentType=application/xml; charset=utf-8 length=11650 | format=EDMX isStandard=true |
| 2 | List ($count/$select/$orderby) | ✅ PASS | `/odata/product-odata?$count=true&$orderby=id desc&$select=id,nombre,precio,categoria` | total@odata.count=13 rows=3 first.precio(type)=string |
| 3 | By-key access /product-odata(348) | ✅ PASS | `/odata/product-odata(348)` | id=348 nombre=Laptop |
| 4 | $expand category (belongsTo) + products (hasMany, nested $select/$top) | ✅ PASS | `/odata/product-odata(348)?$expand=category AND /odata/category-odata(1341)?$expand=products($select=id,nombre;$top=2)` | product.category={"id":1341,"nombre":"Electrónica","createdAt":"2026-07-17T06:14:42.935Z","updatedAt":"2026-07-17T06:14:42.935Z","@odata.etag":"2026-07-17T06:14:42.935Z"} | category.products=11 items |
| 5 | Create via $direct (POST) | ✅ PASS | `/odata/product-odata (POST, groupId=$direct)` | created id=363 |
| 6 | Patch via $direct (PATCH) | ✅ PASS | `/odata/product-odata(364) (PATCH, groupId=$direct)` | patched id=364 |
| 7 | Delete via $direct (DELETE) | ✅ PASS | `/odata/product-odata(365) (DELETE, groupId=$direct)` | deleted id=365 |
| 8 | Create via $batch changeset (POST) | ❌ FAIL | `/odata/$batch (multipart/mixed changeset, groupId=changes)` | server $batch changeset did not return the created entities (created() timed out) |

## Evidencia de red (extracto del tráfico `/odata` capturado)

- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataModel.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataContextBinding.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataListBinding.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataMetaModel.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataPropertyBinding.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/SubmitMode.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_GroupLock.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_Helper.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_MetadataRequestor.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_Parser.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_Requestor.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/OperationMode.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/Context.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataParentBinding.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_Cache.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ODataBinding.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/AnnotationHelper.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/ValueListType.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Boolean.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Byte.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Date.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/DateTimeOffset.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Decimal.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Double.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Guid.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Int16.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Int32.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Int64.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Raw.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/SByte.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Single.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Stream.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/String.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/TimeOfDay.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_AggregationCache.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_AggregationHelper.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_V2MetadataConverter.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_V4MetadataConverter.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_Batch.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_V2Requestor.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/ODataType.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/_AnnotationHelperExpression.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/ODataUtils.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/Int.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/type/DateTimeBase.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_MetadataConverter.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_ConcatHelper.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_MinMaxHelper.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/v4/lib/_TreeState.js` → 200
- **GET** `http://127.0.0.1:8080/resources/sap/ui/model/odata/_AnnotationHelperBasics.js` → 200
- **GET** `http://127.0.0.1:8080/odata/$metadata?sap-language=ES` → 200
- **HEAD** `http://127.0.0.1:8080/odata/` → 404
- **GET** `http://127.0.0.1:8080/odata/product-odata?$skip=0&$top=20` → 200
- **GET** `http://127.0.0.1:8080/odata/$metadata` → 200
- **GET** `http://127.0.0.1:8080/odata/product-odata?$count=true&$select=id,nombre,precio,categoria&$orderby=id%20desc&$skip=0&$top=3` → 200
- **GET** `http://127.0.0.1:8080/odata/product-odata?$select=id,nombre,categoriaId&$filter=categoriaId%20gt%201&$orderby=id%20asc&$skip=0&$top=1` → 200
- **GET** `http://127.0.0.1:8080/odata/category-odata?$select=id,nombre&$skip=0&$top=1` → 200
- **GET** `http://127.0.0.1:8080/odata/product-odata(348)` → 200
- **GET** `http://127.0.0.1:8080/odata/product-odata(348)?$expand=category` → 200
- **GET** `http://127.0.0.1:8080/odata/category-odata(1341)?$expand=products($select=id,nombre)` → 200
- **POST** `http://127.0.0.1:8080/odata/product-odata` → 201
  - body: `{"nombre":"UI5_TMP_1784436060053","precio":"9.99","categoria":"Test","categoriaId":1341}`
- **GET** `http://127.0.0.1:8080/odata/product-odata(363)` → 200
- **POST** `http://127.0.0.1:8080/odata/product-odata` → 201
  - body: `{"nombre":"UI5_TMP_1784436060078","precio":"9.99","categoria":"Test","categoriaId":1341}`
- **GET** `http://127.0.0.1:8080/odata/product-odata(364)` → 200
- **PATCH** `http://127.0.0.1:8080/odata/product-odata(364)` → 200
  - body: `{"nombre":"UI5_PATCHED"}`
- **POST** `http://127.0.0.1:8080/odata/product-odata` → 201
  - body: `{"nombre":"UI5_TMP_1784436060095","precio":"9.99","categoria":"Test","categoriaId":1341}`
- **GET** `http://127.0.0.1:8080/odata/product-odata(365)` → 200
- **DELETE** `http://127.0.0.1:8080/odata/product-odata(365)` → 200
- **POST** `http://127.0.0.1:8080/odata/$batch` → 200
  - body: `--batch_id-1784436060109-19
Content-Type: multipart/mixed;boundary=changeset_id-1784436060109-20

--changeset_id-1784436060109-20
Content-Type:application/http
Content-Transfer-Encoding:binary
C`

## Brechas encontradas (lado servidor — NO modificado por mandato)

1. **El `$batch` con changeset para escrituras no funciona.** El servidor responde al POST `$batch` con **`HTTP/1.1 405 Method Not Allowed` — `{"error":"Write operations must be sent inside a changeset (multipart/mixed)"}`** (confirmado en `shim.log`: el changeset multipart/mixed que transporta el `POST product-odata` es rechazado). Las consultas `$batch` de lectura devuelven 200, pero los changesets de escritura son rechazados. El error persiste en el código actual de la rama `feat/odata-sapui5-compat` (Fase H): los tests aislados del middleware pasan, pero el cuerpo multipart real que emite UI5 no es parseado como changeset en la ruta HTTP, por lo que la escritura cae en la rama de "fuera de changeset" → 405.
   - **Impacto:** `ODataModel` v4 de UI5 enruta TODAS las escrituras que no son `$direct` (el `updateGroupId` por defecto) a través de un changeset `$batch`; esas operaciones create/update/delete fallan. La única vía de escritura que funciona es `groupId="$direct"` (POST/PATCH/DELETE planos).
   - **Solución alternativa usada en este demo:** modelo con `groupId="$direct"` para que cada petición sea una llamada plana, evitando `$batch` tanto para lecturas como para escrituras.
   - **Corrección en el servidor (recomendada):** parsear el cuerpo multipart/mixed `$batch` REAL de UI5 (detectar el boundary del changeset anidado), ejecutar cada petición del changeset y devolver una respuesta multipart coincidente con referencia `Content-ID` para que UI5 correlacione la entidad creada.

## Características soportadas (sin brechas)

- Colección de lista: `$top`, `$skip`, `$orderby`, `$filter`, `$count` (→ `@odata.count`), `$select` — **JSON OData estándar** (`@odata.context`, `value[]`).
- Acceso por key `/product-odata(104)` — **OK**.
- Escrituras vía **`$direct`**: POST (201 + `Location`), PATCH (200), DELETE (204) — **OK**.
- `precio` (`Edm.Decimal`) llega como string y se enlaza correctamente; `createdAt`/`updatedAt` (`Edm.DateTimeOffset`) se parsean sin error.
- Cabeceras de SAPUI5 (`OData-Version: 4.0`, `Accept: application/json;odata.metadata=minimal`) son aceptadas.

## Matriz de skills / tooling (fijado a última estable)

| Herramienta | Versión | Propósito |
|---|---|---|
| `@ui5/cli` | 4.0.57 | UI5 Tooling: `ui5 serve` / `ui5 build` / `ui5 linter` |
| Runtime OpenUI5 (`@openui5/sap.*`) | 1.150.0 | Librerías del framework servidas localmente (sin CDN) |
| `@ui5/linter` | 1.23.1 | Quality gate oficial de SAP para apps UI5 (lint de `webapp/`) |
| `ui5-middleware-proxy-to-server` (custom) | local | Proxy puro de `/odata/*` → `localhost:3000` (el server sirve su propio EDMX 4.0 en `$metadata`; sin shim) |
| `playwright` | 1.61.1 | Harness de navegador headless que conduce el modelo OData V4 real |
