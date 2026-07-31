sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("ui5.odata.demo.controller.App", {

    onInit: function () {
      this.oRouter = this.getOwnerComponent().getRouter();
      this.oModel = this.getOwnerComponent().getModel();
      window.appController = this;
      window.__suite = { metaReady: false, metaError: null, results: [], rawMetadata: null };
      var that = this;
      var markReady = function () { window.__suite.metaReady = true; };
      var markErr = function (e) { window.__suite.metaError = String(e.stack || e); };
      var waitMeta = function () {
        var m = that.getOwnerComponent().getModel();
        if (!m) { setTimeout(waitMeta, 300); return; }
        try {
          var mm = m.getMetaModel();
          if (mm && typeof mm.fetchEntityContainer === "function") {
            mm.fetchEntityContainer().then(markReady).catch(markErr);
          }
        } catch (e) { markErr(e); }
        if (typeof m.attachMetadataLoaded === "function") {
          m.attachMetadataLoaded(markReady);
        }
      };
      waitMeta();
      this._renderLog();
    },

    onNavToDemo: function () {
      this.oRouter.navTo("demo");
    },

    onNavToFinance: function () {
      this.oRouter.navTo("finance");
    },

    _log: function (name, ok, info, url) {
      var entry = { name: name, ok: !!ok, info: info || "", url: url || "" };
      window.__suite.results.push(entry);
      this._renderLog();
      return entry;
    },

    _renderLog: function () {
      var lines = [];
      lines.push("metaReady: " + window.__suite.metaReady +
        (window.__suite.metaError ? " (ERROR: " + window.__suite.metaError + ")" : ""));
      window.__suite.results.forEach(function (r) {
        lines.push((r.ok ? "PASS" : "FAIL") + " | " + r.name + " | " + r.info +
          (r.url ? " | " + r.url : ""));
      });
      var oLog = this.byId("log");
      if (oLog) { oLog.setValue(lines.join("\n")); }
    },

    /* ---- helper: fetch a real product row from the list ---- */
    _fetchFirstRow: function () {
      var oModel = this.oModel;
      return new Promise(function (resolve, reject) {
        var oBinding = oModel.bindList("/product-odata", undefined, undefined, undefined, {
          $select: ["id", "nombre", "categoriaId"],
          $filter: "categoriaId gt 1",
          $orderby: "id asc"
        });
        oBinding.attachEventOnce("dataReceived", function (oEvent) {
          var oError = oEvent.getParameter("error");
          if (oError) return reject(oError);
          var aCtx = oBinding.getContexts(0, 1);
          if (aCtx.length === 0) return reject(new Error("No valid products found (with categoriaId > 1)"));
          resolve(aCtx[0].getObject());
        });
        oBinding.getContexts(0, 1);
      });
    },

    _fetchFirstCategory: function () {
      var oModel = this.oModel;
      return new Promise(function (resolve, reject) {
        var oBinding = oModel.bindList("/category-odata", undefined, undefined, undefined, {
          $select: ["id", "nombre"]
        });
        oBinding.attachEventOnce("change", function () {
          var aCtx = oBinding.getContexts(0, 1);
          if (aCtx.length === 0) return reject(new Error("No categories found"));
          resolve(aCtx[0].getObject());
        });
        oBinding.attachEventOnce("dataReceived", function (oEvent) {
          var oError = oEvent.getParameter("error");
          if (oError) return reject(oError);
        });
        oBinding.getContexts(0, 1);
      });
    },

    /* ---- 1. List + $count/$select/$orderby/$filter ---- */
    testList: function () {
      var oModel = this.oModel, that = this;
      return new Promise(function (resolve) {
        try {
          var oBinding = oModel.bindList("/product-odata", undefined, undefined, undefined, {
            $count: true,
            $select: ["id", "nombre", "precio", "categoria"],
            $orderby: "id desc"
          });
          oBinding.attachEventOnce("dataReceived", function (oEvent) {
            var oError = oEvent.getParameter("error");
            if (oError) {
              resolve(that._log("List ($count/$select/$orderby)", false,
                String(oError.message || oError), "/odata/product-odata (list query)"));
              return;
            }
            var iCount = oBinding.getCount();
            var aCtx = oBinding.getContexts(0, 3);
            var aRows = aCtx.map(function (c) { return c.getObject(); });
            var ok = iCount > 0 && aRows.length > 0 &&
              typeof aRows[0].precio === "string";
            var info = "total@odata.count=" + iCount + " rows=" + aRows.length +
              " first.precio(type)=" + typeof (aRows[0] && aRows[0].precio);
            resolve(that._log("List ($count/$select/$orderby)", ok, info,
              "/odata/product-odata?$count=true&$orderby=id desc&$select=id,nombre,precio,categoria"));
          });
          oBinding.getContexts(0, 3);
        } catch (e) {
          resolve(that._log("List ($count/$select/$orderby)", false, String(e.stack || e)));
        }
      });
    },

    /* ---- 2. By-key access ---- */
    testByKey: function (productRow) {
      var oModel = this.oModel, that = this;
      var id = productRow.id;
      return new Promise(function (resolve) {
        try {
          var oContext = oModel.bindContext("/product-odata(" + id + ")").getBoundContext();
          oContext.requestObject().then(function (o) {
            var ok = o && o.id === id;
            resolve(that._log("By-key access /product-odata(" + id + ")", ok,
              "id=" + (o && o.id) + " nombre=" + (o && o.nombre), "/odata/product-odata(" + id + ")"));
          }).catch(function (e) {
            resolve(that._log("By-key access /product-odata(" + id + ")", false, String(e.stack || e), "/odata/product-odata(" + id + ")"));
          });
        } catch (e) {
          resolve(that._log("By-key access /product-odata(" + id + ")", false, String(e.stack || e)));
        }
      });
    },

    /* ---- 3. $expand belongsTo (category on product) + hasMany (products on category) ---- */
    testExpand: function (productRow, catRow) {
      var oModel = this.oModel, that = this;
      var pid = productRow.id;
      var cid = catRow.id;
      return new Promise(function (resolve) {
        try {
          var oCtxProduct = oModel.bindContext("/product-odata(" + pid + ")", undefined, {
            $expand: { category: true }
          }).getBoundContext();
          oCtxProduct.requestObject().then(function (o) {
            var hasCat = !!(o && o.category);
            var oCtxCat = oModel.bindContext("/category-odata(" + cid + ")", undefined, {
              $expand: { products: { "$select": ["id", "nombre"] } }
            }).getBoundContext();
            oCtxCat.requestObject().then(function (c) {
              var hasProd = !!(c && Array.isArray(c.products));
              var info = "product.category=" + (hasCat ? JSON.stringify(o.category) : "MISSING") +
                " | category.products=" + (hasProd ? c.products.length + " items" : "MISSING");
              resolve(that._log("$expand category (belongsTo) + products (hasMany, nested $select/$top)", hasCat && hasProd, info,
                "/odata/product-odata(" + pid + ")?$expand=category AND /odata/category-odata(" + cid + ")?$expand=products($select=id,nombre;$top=2)"));
            }).catch(function (e) {
              resolve(that._log("$expand category + products", false, String(e.stack || e)));
            });
          }).catch(function (e) {
            resolve(that._log("$expand category + products", false, String(e.stack || e)));
          });
        } catch (e) {
          resolve(that._log("$expand category + products", false, String(e.stack || e)));
        }
      });
    },

    /* ---- helper: create a temp product via $direct, return its id ---- */
    _createTempDirect: function (catId) {
      var oModel = this.oModel, that = this;
      return new Promise(function (resolve, reject) {
        try {
          var oList = oModel.bindList("/product-odata", undefined, undefined, undefined, { "$$updateGroupId": "$direct" });
          oList.initialize();
          var oNew = oList.create(
            { nombre: "UI5_TMP_" + Date.now(), precio: "9.99", categoria: "Test", categoriaId: catId },
            false, false
          );
          oNew.created().then(function () {
            resolve({ id: oNew.getProperty("id"), ctx: oNew });
          }).catch(reject);
        } catch (e) { reject(e); }
      });
    },

    /* ---- 4. Create via $direct (POST) ---- */
    testCreateDirect: function (catId) {
      var that = this;
      return this._createTempDirect(catId).then(function (o) {
        window.__tmpCtx = o.ctx;
        return that._log("Create via $direct (POST)", !!o.id, "created id=" + o.id,
          "/odata/product-odata (POST, groupId=$direct)");
      }).catch(function (e) {
        return that._log("Create via $direct (POST)", false, String(e.stack || e));
      });
    },

    /* ---- 5. Patch via $direct (PATCH) ---- */
    testPatchDirect: function (catId) {
      var that = this;
      return this._createTempDirect(catId).then(function (o) {
        return o.ctx.setProperty("nombre", "UI5_PATCHED", "$direct").then(function () {
          return that._log("Patch via $direct (PATCH)", true, "patched id=" + o.id,
            "/odata/product-odata(" + o.id + ") (PATCH, groupId=$direct)");
        });
      }).catch(function (e) {
        return that._log("Patch via $direct (PATCH)", false, String(e.stack || e));
      });
    },

    /* ---- 6. Delete via $direct (DELETE) ---- */
    testDeleteDirect: function (catId) {
      var that = this;
      return this._createTempDirect(catId).then(function (o) {
        return o.ctx.delete("$direct").then(function () {
          return that._log("Delete via $direct (DELETE)", true, "deleted id=" + o.id,
            "/odata/product-odata(" + o.id + ") (DELETE, groupId=$direct)");
        });
      }).catch(function (e) {
        return that._log("Delete via $direct (DELETE)", false, String(e.stack || e));
      });
    },

    /* ---- 7. Create via $batch changeset (Content-ID) ---- */
    testBatch: function (catId) {
      var oModel = this.oModel, that = this;
      return new Promise(function (resolve) {
        try {
          var oList = oModel.bindList("/product-odata", undefined, undefined, undefined, { "$$updateGroupId": "changes" });
          oList.initialize();
          var ts = Date.now();
          var oNew1 = oList.create(
            { nombre: "UI5_BATCH_" + ts + "_A", precio: "5.55", categoria: "Electrónica", categoriaId: catId },
            true, false
          );
          var oNew2 = oList.create(
            { nombre: "UI5_BATCH_" + ts + "_B", precio: "7.77", categoria: "Electrónica", categoriaId: catId },
            true, false
          );
          var guard = function (p) {
            return Promise.race([
              p,
              new Promise(function (res) { setTimeout(function () { res(false); }, 8000); })
            ]);
          };
          oModel.submitBatch("changes").then(function () {
            return Promise.all([guard(oNew1.created()), guard(oNew2.created())]);
          }).then(function (oks) {
            if (oks[0] === false || oks[1] === false) {
              resolve(that._log("Create via $batch changeset (POST)", false,
                "server $batch changeset did not return the created entities (created() timed out)",
                "/odata/$batch (multipart/mixed changeset, groupId=changes)"));
              return;
            }
            var id1 = oNew1.getProperty("id");
            var id2 = oNew2.getProperty("id");
            oNew1.delete("$direct").catch(function () {});
            oNew2.delete("$direct").catch(function () {});
            resolve(that._log("Create via $batch changeset (POST)", !!id1 && !!id2,
              "batch created ids=" + id1 + "," + id2,
              "/odata/$batch (multipart/mixed changeset, groupId=changes)"));
          }).catch(function (e) {
            resolve(that._log("Create via $batch changeset (POST)", false, String(e.stack || e),
              "/odata/$batch (multipart/mixed changeset, groupId=changes)"));
          });
        } catch (e) {
          resolve(that._log("Create via $batch changeset (POST)", false, String(e.stack || e)));
        }
      });
    },

    /* ---- 8. Probe metadata served to UI5 (EDMX 4.0 / CSDL, no shim) ---- */
    testRawMetadata: function () {
      var that = this;
      return fetch("/odata/$metadata").then(function (r) {
        return r.text().then(function (txt) {
          var ct = r.headers.get("content-type") || "";
          var isStd = false;
          var info = "contentType=" + ct + " length=" + txt.length;
          if (/application\/xml/.test(ct) || /<edmx:Edmx/i.test(txt)) {
            isStd = /<edmx:Edmx/i.test(txt) && /<EntityContainer/i.test(txt) && /<EntitySet/i.test(txt);
            info += " | format=EDMX isStandard=" + isStd;
          } else {
            try {
              var j = JSON.parse(txt);
              var container = j.$EntityContainer;
              var hasContainer = !!container && !!j[container];
              var hasEntityType = Object.keys(j).some(function (k) {
                return j[k] && j[k].$kind === "EntityType";
              });
              isStd = hasContainer && hasEntityType;
              info += " | format=CSDL isStandard=" + isStd;
            } catch (e) {
              info += " | parseError=" + String(e);
            }
          }
          return that._log("Metadata served to UI5 (/odata/$metadata)", isStd,
            "servedToUI5IsStandard=" + isStd + " " + info, "/odata/$metadata");
        });
      }).catch(function (e) {
        return that._log("Metadata served to UI5 (/odata/$metadata)", false, String(e.stack || e), "/odata/$metadata");
      });
    },

    /* ---- orchestration (sequential to avoid entity-set cache races) ---- */
    onRunAll: function () {
      var that = this;
      window.__suite.results = [];
      this._renderLog();
      var tests = [
        { fn: this.testRawMetadata, name: "Metadata" },
        { fn: this.testList, name: "List" },
      ];
      function run(i) {
        if (i >= tests.length) {
          // resolve IDs then run the rest
          Promise.all([that._fetchFirstRow(), that._fetchFirstCategory()]).then(function (rows) {
            var prod = rows[0], cat = rows[1];
            var idTests = [
              { fn: function () { return that.testByKey(prod); }, name: "ByKey" },
              { fn: function () { return that.testExpand(prod, cat); }, name: "Expand" },
              { fn: function () { return that.testCreateDirect(cat.id); }, name: "Create" },
              { fn: function () { return that.testPatchDirect(cat.id); }, name: "Patch" },
              { fn: function () { return that.testDeleteDirect(cat.id); }, name: "Delete" },
              { fn: function () { return that.testBatch(cat.id); }, name: "Batch" },
            ];
            function runId(j) {
              if (j >= idTests.length) {
                that._renderLog();
                MessageToast.show("Suite finished: " +
                  window.__suite.results.filter(function (r) { return r.ok; }).length + "/" +
                  window.__suite.results.length + " passed");
                return;
              }
              var t = idTests[j];
              // N21 (ciclo 13): el timer del race se cancelaba; al resolver el
              // test antes de los 30s, el setTimeout huérfano logueaba un
              // "TEST TIMEOUT (30s)" fantasma ~30s después. clearTimeout evita
              // que el harness reporte FAIL falsos en logs largos.
              var timeoutId = null;
              Promise.race([
                Promise.resolve().then(t.fn),
                new Promise(function (res) {
                  timeoutId = setTimeout(function () {
                    that._log(t.name, false, "TEST TIMEOUT (30s)", "");
                    res();
                  }, 30000);
                })
              ]).then(function () {
                if (timeoutId !== null) clearTimeout(timeoutId);
                runId(j + 1);
              });
            }
            runId(0);
          }).catch(function (e) {
            that._log("ID resolution", false, "Failed to fetch product/category IDs: " + String(e));
          });
          return;
        }
        var t = tests[i];
        // N21 (ciclo 13): clearTimeout del race para evitar FAIL fantasma
        // cuando el test resuelve antes de los 30s (ver runId).
        var timeoutId = null;
        Promise.race([
          Promise.resolve().then(t.fn.bind(that)),
          new Promise(function (res) {
            timeoutId = setTimeout(function () {
              that._log(t.name, false, "TEST TIMEOUT (30s)", "");
              res();
            }, 30000);
          })
        ]).then(function () {
          if (timeoutId !== null) clearTimeout(timeoutId);
          run(i + 1);
        });
      }
      run(0);
    },

    onResetLog: function () {
      window.__suite.results = [];
      this._renderLog();
    },

    onRowSelect: function (oEvent) {
      var oCtx = oEvent.getParameter("rowContext");
      if (!oCtx) return;
      var oModel = this.oModel;
      var that = this;
      var oData = oCtx.getObject();
      var id = oData.id;

      this.byId("txtByKey").setText(JSON.stringify(oData));

      // $expand=category on the selected product
      var oCatCtx = oModel.bindContext("/product-odata(" + id + ")", undefined, {
        $expand: { category: true }
      }).getBoundContext();
      oCatCtx.requestObject().then(function (o) {
        that.byId("txtExpandCat").setText(o && o.category
          ? JSON.stringify(o.category) : "MISSING");
      }).catch(function (e) {
        that.byId("txtExpandCat").setText("ERROR: " + (e.message || e));
      });

      // $expand=products on the product's category (hasMany)
      var catId = oData.categoriaId;
      if (catId) {
        var oProdCtx = oModel.bindContext("/category-odata(" + catId + ")", undefined, {
          $expand: { products: { "$select": ["id", "nombre"] } }
        }).getBoundContext();
        oProdCtx.requestObject().then(function (o) {
          that.byId("txtExpandProd").setText(o && Array.isArray(o.products)
            ? JSON.stringify(o.products.find(element => element.id === oData.id)) : "[]");
        }).catch(function (e) {
          that.byId("txtExpandProd").setText("ERROR: " + (e.message || e));
        });
      } else {
        that.byId("txtExpandProd").setText("NO categoriaId");
      }
    }
  });
});
