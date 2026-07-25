sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.Finance", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
        },

        onNavToDemo: function () {
            this.oRouter.navTo("demo");
        },

        onNavToFinance: function () {
            this.oRouter.navTo("finance");
        },

        onEntityPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            var sEntity = oItem.data("entityName");
            if (sEntity) {
                this.oRouter.navTo(sEntity + "List");
            }
        }
    });
});
