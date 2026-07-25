sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageStrip",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, MessageStrip, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.CustomerList", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oModel = this.getOwnerComponent().getModel();
        },

        onFilter: function () {
            var oTable = this.byId("tblCustomers");
            if (!oTable) return;

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            var aFilters = [];
            var sNombre = this.byId("filterNombre").getValue();
            var sPais = this.byId("filterPais").getValue();

            if (sNombre) {
                aFilters.push(new Filter("nombre", FilterOperator.Contains, sNombre));
            }
            if (sPais) {
                aFilters.push(new Filter("pais", FilterOperator.Contains, sPais));
            }

            oBinding.filter(aFilters);
        },

        onClearFilter: function () {
            this.byId("filterNombre").setValue("");
            this.byId("filterPais").setValue("");

            var oTable = this.byId("tblCustomers");
            if (!oTable) return;

            var oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
        },

        onCustomerSelect: function (oEvent) {
            var oCtx = oEvent.getParameter("rowContext");
            if (!oCtx) return;
            var sId = oCtx.getProperty("id");
            this.oRouter.navTo("customerDetail", {
                customerId: sId
            });
        },

        // ---- Create Customer ----

        onCreateCustomer: function () {
            var that = this;
            if (!this._oCustomerCreateDialog) {
                this.loadFragment({
                    name: "ui5.odata.demo.fragment.CustomerCreate"
                }).then(function (oDialog) {
                    that._oCustomerCreateDialog = oDialog;
                    that._oCustomerCreateDialog.open();
                });
            } else {
                this._hideCustomerMessageStrips();
                this._oCustomerCreateDialog.open();
            }
        },

        _showCustomerMessageStrip: function (sType, sMessage) {
            var oMsgStripBox = this.byId("createCustomerMessageStripBox");
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

        _hideCustomerMessageStrips: function () {
            var oMsgStripBox = this.byId("createCustomerMessageStripBox");
            if (!oMsgStripBox) return;
            oMsgStripBox.destroyItems();
            oMsgStripBox.setVisible(false);
        },

        onCreateCustomerSave: function () {
            this._hideCustomerMessageStrips();

            var sId = this.byId("createCustomerId").getValue();
            var sNombre = this.byId("createCustomerNombre").getValue();
            var sPais = this.byId("createCustomerPais").getValue();

            if (!sNombre) {
                this._showCustomerMessageStrip("Error", "El nombre es obligatorio");
                return;
            }
            if (!sPais) {
                this._showCustomerMessageStrip("Error", "El país es obligatorio");
                return;
            }

            var oData = {
                nombre: sNombre,
                pais: sPais
            };
            if (sId) {
                oData.id = sId;
            }

            var oBinding = this.oModel.bindList("/customer-odata");
            var that = this;
            oBinding.create(oData, {groupId: "$direct"}).created().then(function () {
                that._oCustomerCreateDialog.close();
                MessageToast.show("Cliente " + (oData.id || oData.nombre) + " creado exitosamente");
                var oTable = that.byId("tblCustomers");
                if (oTable) {
                    var oBinding = oTable.getBinding("rows");
                    if (oBinding) oBinding.refresh();
                }
            }, function (oError) {
                if (!oError.canceled) {
                    var sMsg = oError.message || "Error al crear el cliente";
                    that._showCustomerMessageStrip("Error", sMsg);
                }
            });
        },

        onCreateCustomerCancel: function () {
            this._oCustomerCreateDialog.close();
        },

        onCreateCustomerDialogClosed: function () {
            this._hideCustomerMessageStrips();
        }
    });
});