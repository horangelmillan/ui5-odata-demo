sap.ui.define([
  "sap/ui/core/UIComponent"
], function (UIComponent) {
  "use strict";
  return UIComponent.extend("ui5.odata.demo.Component", {
    metadata: {
      manifest: "json",
      properties: {
        componentData: "object"
      }
    },
    init: function () {
      UIComponent.prototype.init.apply(this, arguments);
      this.getRouter().initialize();
    }
  });
});
