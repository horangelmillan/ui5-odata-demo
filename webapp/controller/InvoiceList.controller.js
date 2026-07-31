sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/MessageStrip",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageBox, MessageToast, MessageStrip, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.InvoiceList", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oModel = this.getOwnerComponent().getModel();
            this._oSelectedContext = null;
        },

        onFilter: function () {
            var oTable = this.byId("tblInvoices");
            if (!oTable) return;

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            var aFilters = [];
            var sEstado = this.byId("filterEstado").getSelectedKey();
            var sMoneda = this.byId("filterMoneda").getSelectedKey();

            if (sEstado) {
                aFilters.push(new Filter("estado", FilterOperator.EQ, sEstado));
            }
            if (sMoneda) {
                aFilters.push(new Filter("moneda", FilterOperator.EQ, sMoneda));
            }

            oBinding.filter(aFilters);
        },

        onClearFilter: function () {
            this.byId("filterEstado").setSelectedKey("");
            this.byId("filterMoneda").setSelectedKey("");

            var oTable = this.byId("tblInvoices");
            if (!oTable) return;

            var oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
        },

        onInvoiceSelect: function (oEvent) {
            var oCtx = oEvent.getParameter("rowContext");
            if (!oCtx) return;
            this._oSelectedContext = oCtx;
        },

        _getSelectedContext: function () {
            if (this._oSelectedContext) {
                return this._oSelectedContext;
            }
            var oTable = this.byId("tblInvoices");
            if (!oTable) return null;
            var aSelected = oTable.getSelectedIndices();
            if (aSelected.length === 0) return null;
            return oTable.getContextByIndex(aSelected[0]);
        },

        _showMessageStrip: function (sDialogId, sType, sMessage) {
            var oMsgStripBox = this.byId(sDialogId);
            if (!oMsgStripBox) return;
            oMsgStripBox.destroyItems();
            var oMsgStrip = new MessageStrip({
                type: sType,
                text: sMessage,
                showIcon: true,
                showCloseButton: true
            });
            oMsgStrip.addEventDelegate({
                onAfterRendering: function () {
                    oMsgStripBox.setVisible(true);
                }
            }, oMsgStrip);
            oMsgStripBox.addItem(oMsgStrip);
        },

        _hideMessageStrips: function (sDialogId) {
            var oMsgStripBox = this.byId(sDialogId);
            if (!oMsgStripBox) return;
            oMsgStripBox.destroyItems();
            oMsgStripBox.setVisible(false);
        },

        _validateInvoiceForm: function (sPrefix) {
            var sId = this.byId(sPrefix + "InvoiceId") ? this.byId(sPrefix + "InvoiceId").getValue() : "";
            var sCustomerKey = this.byId(sPrefix + "InvoiceCustomer").getSelectedKey();
            var sCompanyKey = this.byId(sPrefix + "InvoiceCompany").getSelectedKey();
            var sImporte = this.byId(sPrefix + "InvoiceImporte").getValue();
            var sMoneda = this.byId(sPrefix + "InvoiceMoneda").getSelectedKey();
            var sFecha = this.byId(sPrefix + "InvoiceFecha").getValue();

            if (sPrefix === "create" && !sId) {
                this._showMessageStrip(sPrefix + "InvoiceMessageStripBox", "Error", "El campo ID es obligatorio");
                return null;
            }
            if (!sCustomerKey) {
                this._showMessageStrip(sPrefix + "InvoiceMessageStripBox", "Error", "Seleccione un cliente");
                return null;
            }
            if (!sCompanyKey) {
                this._showMessageStrip(sPrefix + "InvoiceMessageStripBox", "Error", "Seleccione una sociedad");
                return null;
            }
            if (!sImporte || parseFloat(sImporte) <= 0) {
                this._showMessageStrip(sPrefix + "InvoiceMessageStripBox", "Error", "El importe debe ser un decimal positivo");
                return null;
            }
            if (!sMoneda) {
                this._showMessageStrip(sPrefix + "InvoiceMessageStripBox", "Error", "Seleccione una moneda");
                return null;
            }
            if (!sFecha) {
                this._showMessageStrip(sPrefix + "InvoiceMessageStripBox", "Error", "Seleccione una fecha");
                return null;
            }

            return {
                id: sId,
                customerId: sCustomerKey,
                companyId: sCompanyKey,
                importe: parseFloat(sImporte),
                moneda: sMoneda,
                fecha: sFecha,
                estado: "PENDIENTE"
            };
        },

        // ---- Create Invoice ----

        onCreateInvoice: function () {
            var that = this;
            if (!this._oInvoiceCreateDialog) {
                this.loadFragment({
                    name: "ui5.odata.demo.fragment.InvoiceCreate"
                }).then(function (oDialog) {
                    that._oInvoiceCreateDialog = oDialog;
                    that._oInvoiceCreateDialog.open();
                });
            } else {
                this._hideMessageStrips("createInvoiceMessageStripBox");
                this._oInvoiceCreateDialog.open();
            }
        },

        onCreateInvoiceSave: function () {
            this._hideMessageStrips("createInvoiceMessageStripBox");

            var oData = this._validateInvoiceForm("create");
            if (!oData) return;

            var oBinding = this.oModel.bindList("/invoice-odata");
            var that = this;
            oBinding.create(oData, {groupId: "$direct"}).created().then(function () {
                that._oInvoiceCreateDialog.close();
                MessageToast.show("Factura " + oData.id + " creada exitosamente");
                var oTable = that.byId("tblInvoices");
                if (oTable) {
                    var oBinding = oTable.getBinding("rows");
                    if (oBinding) oBinding.refresh();
                }
            }, function (oError) {
                if (!oError.canceled) {
                    var sMsg = oError.message || "Error al crear la factura";
                    that._showMessageStrip("createInvoiceMessageStripBox", "Error", sMsg);
                }
            });
        },

        onCreateInvoiceCancel: function () {
            this._oInvoiceCreateDialog.close();
        },

        onCreateInvoiceDialogClosed: function () {
            this._hideMessageStrips("createInvoiceMessageStripBox");
        },

        // ---- Edit Invoice ----

        onEditInvoice: function () {
            var oCtx = this._getSelectedContext();
            if (!oCtx) {
                MessageToast.show("Seleccione una factura primero");
                return;
            }

            var that = this;
            if (!this._oInvoiceEditDialog) {
                this.loadFragment({
                    name: "ui5.odata.demo.fragment.InvoiceEdit"
                }).then(function (oDialog) {
                    that._oInvoiceEditDialog = oDialog;
                    that._fillEditDialog(oCtx);
                    that._oInvoiceEditDialog.open();
                });
            } else {
                this._hideMessageStrips("editInvoiceMessageStripBox");
                this._fillEditDialog(oCtx);
                this._oInvoiceEditDialog.open();
            }
        },

        _fillEditDialog: function (oCtx) {
            this.byId("editInvoiceId").setValue(oCtx.getProperty("id"));
            this.byId("editInvoiceCustomer").setSelectedKey(oCtx.getProperty("customerId"));
            this.byId("editInvoiceCompany").setSelectedKey(oCtx.getProperty("companyId"));
            this.byId("editInvoiceImporte").setValue(oCtx.getProperty("importe"));
            this.byId("editInvoiceMoneda").setSelectedKey(oCtx.getProperty("moneda"));
            this.byId("editInvoiceFecha").setValue(oCtx.getProperty("fecha"));
        },

        onEditInvoiceSave: function () {
            this._hideMessageStrips("editInvoiceMessageStripBox");

            var oCtx = this._getSelectedContext();
            if (!oCtx) {
                MessageToast.show("Seleccione una factura primero");
                return;
            }

            var sCustomerKey = this.byId("editInvoiceCustomer").getSelectedKey();
            var sCompanyKey = this.byId("editInvoiceCompany").getSelectedKey();
            var sImporte = this.byId("editInvoiceImporte").getValue();
            var sMoneda = this.byId("editInvoiceMoneda").getSelectedKey();
            var sFecha = this.byId("editInvoiceFecha").getValue();

            if (!sCustomerKey || !sCompanyKey || !sImporte || parseFloat(sImporte) <= 0 || !sMoneda || !sFecha) {
                this._showMessageStrip("editInvoiceMessageStripBox", "Error", "Todos los campos son obligatorios");
                return;
            }

            oCtx.setProperty("customerId", sCustomerKey);
            oCtx.setProperty("companyId", sCompanyKey);
            oCtx.setProperty("importe", parseFloat(sImporte));
            oCtx.setProperty("moneda", sMoneda);
            oCtx.setProperty("fecha", sFecha);

            var that = this;
            this.oModel.submitBatch(this.oModel.getUpdateGroupId()).then(function () {
                that._oInvoiceEditDialog.close();
                MessageToast.show("Factura actualizada exitosamente");
                var oTable = that.byId("tblInvoices");
                if (oTable) {
                    var oBinding = oTable.getBinding("rows");
                    if (oBinding) oBinding.refresh();
                }
            }, function (oError) {
                that._showMessageStrip("editInvoiceMessageStripBox", "Error", oError.message || "Error al actualizar la factura");
            });
        },

        onEditInvoiceCancel: function () {
            this._oInvoiceEditDialog.close();
        },

        onEditInvoiceDialogClosed: function () {
            this._hideMessageStrips("editInvoiceMessageStripBox");
        },

        // ---- Delete Invoice ----

        onDeleteInvoice: function () {
            var oCtx = this._getSelectedContext();
            if (!oCtx) {
                MessageToast.show("Seleccione una factura primero");
                return;
            }

            var sId = oCtx.getProperty("id");
            var that = this;
            MessageBox.confirm("¿Está seguro de eliminar la factura " + sId + "?", {
                title: "Confirmar eliminación",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._doDeleteInvoice(oCtx);
                    }
                }
            });
        },

        onDeleteInvoiceFromEdit: function () {
            var oCtx = this._getSelectedContext();
            if (!oCtx) return;
            var that = this;
            this._oInvoiceEditDialog.close();
            MessageBox.confirm("¿Está seguro de eliminar la factura " + oCtx.getProperty("id") + "?", {
                title: "Confirmar eliminación",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._doDeleteInvoice(oCtx);
                    }
                }
            });
        },

        _doDeleteInvoice: function (oCtx) {
            var that = this;
            oCtx.delete("$direct").then(function () {
                MessageToast.show("Factura eliminada exitosamente");
                var oTable = that.byId("tblInvoices");
                if (oTable) {
                    var oBinding = oTable.getBinding("rows");
                    if (oBinding) oBinding.refresh();
                }
                that._oSelectedContext = null;
            }, function (oError) {
                if (!oError.canceled) {
                    MessageToast.show(oError.message || "Error al eliminar la factura");
                }
            });
        }
    });
});