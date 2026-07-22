sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "zpp413e/model/models",     // Updated namespace
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
     "sap/ui/export/Spreadsheet",       // <--- ADD THIS
    "sap/ui/export/library"
], function (Controller, Filter, FilterOperator, MessageToast, Fragment, models, MessageBox, DateFormat, Spreadsheet, exportLibrary) { 
    "use strict";

    return Controller.extend("zpp413e.controller.View1", {

        onInit: function () {
            var oLocalModel = models.createLocalModel();
            this.getView().setModel(oLocalModel, "local");
        },

        onSelectionChange: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var oSelection = oLocalModel.getProperty("/selection");

            var sPlant = oSelection.plant;
            var sFromSloc = oSelection.fromSloc;

            // if (sSalesOrder && sSalesOrderItem) {
            //     this.onSalesOrderItemChange();
            // }

            // Only fetch batches if all 4 required fields are filled
            if (!sPlant || !sFromSloc) {
                if (oLocalModel) {
                    oLocalModel.setProperty("/allBatches", []);
                }
                return; 
            }

            this._fetchBatchesInBackground(sPlant, sFromSloc);
        },

        // ==========================================
        // 1. SUGGEST LOGIC (Type-ahead)
        // ==========================================
        onSalesOrderSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        onSalesOrderItemSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sSalesOrder = this.getView().byId("inputSalesOrder").getValue();
            var aFilters = [];

            if (!sSalesOrder) {
                MessageToast.show("Please select a Sales Order first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        // ==========================================
        // 2. VALUE HELP DIALOG LOGIC (F4 Pop-ups)
        // ==========================================
        
        // --- PLANT ---
        onPlantValueHelp: function (oEvent) {
            var oView = this.getView();
            if (!this._oPlantDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.PlantVH", 
                    controller: this
                }).then(function (oDialog) {
                    this._oPlantDialog = oDialog;
                    oView.addDependent(this._oPlantDialog);
                    this._oPlantDialog.open();
                }.bind(this));
            } else {
                this._oPlantDialog.open();
            }
        },

        onPlantVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                this.getView().byId("inputPlant").setValue(oSelectedItem.getTitle());
                this.getView().byId("inputSalesOrder").setValue("");
                this.getView().byId("inputSalesOrderItem").setValue("");
                
                // Also clear the 'To' fields if Plant changes
                this.getView().byId("inputToSalesOrder").setValue("");
                this.getView().byId("inputToSalesOrderItem").setValue("");

                this.onSelectionChange();
            }
        },

        onPlantVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var aFilters = [];
            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Plant", FilterOperator.Contains, sValue),
                        new Filter("PlantName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        // --- SALES ORDER ---
        onSalesOrderValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oSalesOrderDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.SalesOrderVH",
                    controller: this
                }).then(function (oDialog) {
                    this._oSalesOrderDialog = oDialog;
                    oView.addDependent(this._oSalesOrderDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oSalesOrderDialog.getBinding("items").filter([oFilter]);
                    this._oSalesOrderDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oSalesOrderDialog.getBinding("items").filter([oFilter]);
                this._oSalesOrderDialog.open();
            }
        },

        onSalesOrderVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onSalesOrderVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrder = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputSalesOrder").setValue(sSalesOrder);
                this.getView().byId("inputSalesOrderItem").setValue("");
                
                this.onSelectionChange();
            }
        },

        // --- SALES ORDER ITEM ---
        onSalesOrderItemValueHelp: function (oEvent) {
            var oView = this.getView();
            var sSalesOrder = oView.byId("inputSalesOrder").getValue();

            if (!sSalesOrder) {
                MessageToast.show("Please select a Sales Order first");
                return;
            }

            if (!this._oItemDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.SalesOrderItemVH",
                    controller: this
                }).then(function (oDialog) {
                    this._oItemDialog = oDialog;
                    oView.addDependent(this._oItemDialog);
                    var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder);
                    this._oItemDialog.getBinding("items").filter([oFilter]);
                    this._oItemDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder);
                this._oItemDialog.getBinding("items").filter([oFilter]);
                this._oItemDialog.open();
            }
        },

           onSalesOrderItemChange: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var oODataModel = oView.getModel(); 
            
            // Read directly from the model instead of oEvent.getSource()
            var sItemValue = oLocalModel.getProperty("/selection/salesOrderItem");
            var sSalesOrder = oLocalModel.getProperty("/selection/salesOrder");

            if (!sItemValue) {
                oLocalModel.setProperty("/selection/material", "");
                oLocalModel.setProperty("/selection/materialDescription", "");
                return;
            }

            var sPaddedItem = sItemValue.trim().padStart(6, '0');
            var sPaddedOrder = (sSalesOrder || "").trim().padStart(10, '0');
            
            if (!sPaddedOrder || sPaddedOrder === "0000000000") {
                sap.m.MessageBox.error("Please enter a valid Sales Order before specifying an item.");
                return;
            }

            var sContextPath = "/ZI_SALESITEM_VH(SalesOrder='" + sPaddedOrder + "',SalesOrderItem='" + sPaddedItem + "')";
            
            oView.setBusy(true);

            var oContextBinding = oODataModel.bindContext(sContextPath);

            oContextBinding.requestObject().then(function (oData) {
                oView.setBusy(false);

                if (oData) {
                    // Make sure 'Material' and 'ProductDescription' perfectly match your CDS view fields!
                    oLocalModel.setProperty("/selection/material", oData.Material);
                    oLocalModel.setProperty("/selection/materialDescription", oData.ProductDescription);
                }
            }).catch(function (oError) {
                oView.setBusy(false);
                
                oLocalModel.setProperty("/selection/material", "");
                oLocalModel.setProperty("/selection/materialDescription", "");
                
                console.error("Direct fetch failed: ", oError);
                sap.m.MessageToast.show("Invalid item specified for this Sales Order.");
            });
        },

        onItemVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sSalesOrder = this.getView().byId("inputSalesOrder").getValue();
            var aFilters = [new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onItemVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrderItem = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputSalesOrderItem").setValue(sSalesOrderItem);
                
                this.onSelectionChange();
            }
        },

        // // --- TO SALES ORDER (NEW) ---
        onToSalesOrderValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oToSalesOrderDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.ToSalesOrderVH", // Ensure this fragment exists
                    controller: this
                }).then(function (oDialog) {
                    this._oToSalesOrderDialog = oDialog;
                    oView.addDependent(this._oToSalesOrderDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oToSalesOrderDialog.getBinding("items").filter([oFilter]);
                    this._oToSalesOrderDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oToSalesOrderDialog.getBinding("items").filter([oFilter]);
                this._oToSalesOrderDialog.open();
            }
        },

        onToSalesOrderVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onToSalesOrderVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrder = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputToSalesOrder").setValue(sSalesOrder);
                this.getView().byId("inputToSalesOrderItem").setValue(""); // Clear item when header changes
            }
        },

        onToSalesOrderSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        // --- TO SALES ORDER ITEM (NEW) ---
        onToSalesOrderItemValueHelp: function (oEvent) {
            var oView = this.getView();
            var sToSalesOrder = oView.byId("inputToSalesOrder").getValue();

            if (!sToSalesOrder) {
                MessageToast.show("Please select a 'To Sales Order' first");
                return;
            }

            if (!this._oToItemDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.ToSalesOrderItemVH", // Ensure this fragment exists
                    controller: this
                }).then(function (oDialog) {
                    this._oToItemDialog = oDialog;
                    oView.addDependent(this._oToItemDialog);
                    var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder);
                    this._oToItemDialog.getBinding("items").filter([oFilter]);
                    this._oToItemDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder);
                this._oToItemDialog.getBinding("items").filter([oFilter]);
                this._oToItemDialog.open();
            }
        },

        onToItemVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sToSalesOrder = this.getView().byId("inputToSalesOrder").getValue();
            var aFilters = [new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onToItemVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrderItem = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputToSalesOrderItem").setValue(sSalesOrderItem);
            }
        },

        onToSalesOrderItemSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sToSalesOrder = this.getView().byId("inputToSalesOrder").getValue();
            var aFilters = [];

            if (!sToSalesOrder) {
                MessageToast.show("Please select a 'To Sales Order' first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        // ==========================================
        // FROM STORAGE LOCATION LOGIC
        // ==========================================
        onFromSlocSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("StorageLocation", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        onFromSlocValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oFromSlocDialog) {
                sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.FromSlocVH", // Ensure this fragment is created
                    controller: this
                }).then(function (oDialog) {
                    this._oFromSlocDialog = oDialog;
                    oView.addDependent(this._oFromSlocDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oFromSlocDialog.getBinding("items").filter([oFilter]);
                    this._oFromSlocDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oFromSlocDialog.getBinding("items").filter([oFilter]);
                this._oFromSlocDialog.open();
            }
        },

        onFromSlocVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("StorageLocation", FilterOperator.Contains, sValue),
                        new Filter("StorageLocationName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onFromSlocVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSloc = oSelectedItem.getCells()[1].getText();
                this.getView().byId("inputFromSloc").setValue(sSloc);
                
                // Trigger the background fetch since From Sloc changed
                this.onSelectionChange(); 
            }
        },

        // ==========================================
        // TO STORAGE LOCATION LOGIC
        // ==========================================
        onToSlocSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("StorageLocation", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        onToSlocValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oToSlocDialog) {
                sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.ToSlocVH", // Ensure this fragment is created
                    controller: this
                }).then(function (oDialog) {
                    this._oToSlocDialog = oDialog;
                    oView.addDependent(this._oToSlocDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oToSlocDialog.getBinding("items").filter([oFilter]);
                    this._oToSlocDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oToSlocDialog.getBinding("items").filter([oFilter]);
                this._oToSlocDialog.open();
            }
        },

        onToSlocVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("StorageLocation", FilterOperator.Contains, sValue),
                        new Filter("StorageLocationName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onToSlocVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSloc = oSelectedItem.getCells()[1].getText();
                this.getView().byId("inputToSloc").setValue(sSloc);
            }
        },

        // ==========================================
        // BACKGROUND CACHE LOGIC
        // ==========================================
       // ==========================================
        _fetchBatchesInBackground: function (sPlant, sFromSloc) {
            var oView = this.getView();
            var oModel = oView.getModel(); // Primary OData V4 Model
           
            console.log("Attempting fetch...", sPlant, sFromSloc);
 
            // Added all four required filters mapped to the ZI_GET_BATCH entity
            var aFilters = [
                new Filter("Plant", FilterOperator.EQ, sPlant),
                new Filter("StorageLocation", FilterOperator.EQ, sFromSloc) // Ensure property name matches your CDS view
            ];
 
            var mParameters = {
                "$select": "Batch,Plant,StorageLocation,Material,ProductDescription,QTY,MaterialBaseUnit,SDDocument,SDDocumentItem"
            };
 
            // Entity exposed in ZSD_413E_HD
            var oListBinding = oModel.bindList("/ZI_GET_BATCH", null, null, aFilters, mParameters);
 
       
           
            oListBinding.requestContexts(0, 10000).then(function (aContexts) {
                var aAllBatches = aContexts.map(function (oContext) {
                    return oContext.getObject();
                });
               
                console.log("Fetched batches:", aAllBatches);
                oView.getModel("local").setProperty("/allBatches", aAllBatches);
                sap.m.MessageToast.show("Scanner Ready: Loaded " + aAllBatches.length + " batches for this order.");
               
            }).catch(function(oError) {
                console.error("Fetch failed:", oError);
                sap.m.MessageToast.show("Failed to load background batches.");
            });
        },
 

        onAddBatch: function (oEvent) {
            var oView = this.getView();
            var oInput = oView.byId("batchInput");
            
            var sInputValue = oInput.getValue().trim(); 
            var oLocalModel = oView.getModel("local");

            // Helper function to keep focus on the scanner input
            var retainFocus = function() {
                setTimeout(function() {
                    oInput.focus();
                }, 100);
            };

            if (!sInputValue) {
                sap.m.MessageToast.show("Please enter or scan a batch.");
                retainFocus();
                return;
            }

            var aAllBatches = oLocalModel.getProperty("/allBatches") || [];
            var aScanned = oLocalModel.getProperty("/scannedBatches") || [];

               var sFromSloc = oLocalModel.getProperty("/selection/fromSloc");
             var sToSloc = oLocalModel.getProperty("/selection/toSloc");

              var sToSalesOrder = oLocalModel.getProperty("/selection/toSalesOrder");
             var sToSalesOrderItem = oLocalModel.getProperty("/selection/toSalesOrderItem");
           
            // 1. Split the input string by any whitespace (handles spaces, tabs, and newlines!)
            var aInputBatches = sInputValue.split(/\s+/);
            
            // 2. Track what happens during the loop
            var iAddedCount = 0;
            var aNotFound = [];
            var aDuplicates = [];

            // 3. Loop through every batch the user provided
            aInputBatches.forEach(function(sScannedBatch) {
                if (!sScannedBatch) { return; } // Skip empty strings caused by extra spaces

                // Find the batch in the background cache
                var oFoundBatch = aAllBatches.find(function(b) {
                    return b.Batch === sScannedBatch;
                });

                if (!oFoundBatch) {
                    aNotFound.push(sScannedBatch);
                    return; // Skip to the next batch
                }

                // Check if it's already in the table
                var bAlreadyScanned = aScanned.some(function(b) {
                    return b.batch === sScannedBatch;
                });

                if (bAlreadyScanned) {
                    aDuplicates.push(sScannedBatch);
                    return; // Skip to the next batch
                }

                // If found and not a duplicate, add it to our array
                aScanned.push({
                    batch:       oFoundBatch.Batch,
                    material:    oFoundBatch.Material,
                    description: oFoundBatch.ProductDescription,
                    fromSloc:    sFromSloc,
                    toSloc:      sToSloc,
                    salesOrder:  oFoundBatch.SDDocument,
                    salesOrderItem: oFoundBatch.SDDocumentItem,
                    toSalesOrder : sToSalesOrder,
                    toSalesOrderItem : sToSalesOrderItem,
                    plant:       oFoundBatch.Plant,
                    qty:         oFoundBatch.QTY,
                    uom:         oFoundBatch.MaterialBaseUnit
                });
                
                iAddedCount++;
            });

            // 4. If we successfully added at least one batch, update the UI
            if (iAddedCount > 0) {
                oLocalModel.setProperty("/scannedBatches", aScanned);
                
                // Recalculate the yield quantity
                if (this._calculateTotalYield) {
                    this._calculateTotalYield();
                }
            }

            // 5. Build a dynamic feedback message for the user
            var sMessage = "";
            if (iAddedCount > 0) {
                sMessage += "Added " + iAddedCount + " batches. ";
            }
            if (aNotFound.length > 0) {
                sMessage += "\nBatches Not Found or have 0 Quantity: " + aNotFound.join(", ") + ".";
            }
            if (aDuplicates.length > 0) {
                sMessage += "\nBatches Already Added: " + aDuplicates.join(", ") + ".";
            }

            // 6. Show the result
            if (aNotFound.length > 0 || aDuplicates.length > 0) {
                // If there were any errors, use a Warning popup so they don't miss it
                sap.m.MessageBox.warning(sMessage.trim());
            } else {
                // If everything was perfect, just show a quick toast
                sap.m.MessageToast.show(sMessage.trim());
            }

            // 7. Clear the input and lock the cursor back in place
            oInput.setValue("");
            retainFocus();
        },

        // ==========================================
        // DELETE SELECTED BATCHES
        // ==========================================
        onDeleteBatch: function (oEvent) {
            var oView = this.getView();
            var oTable = oView.byId("batchesTable");
            var oLocalModel = oView.getModel("local");

            var aSelectedContexts = oTable.getSelectedContexts();

            if (aSelectedContexts.length === 0) {
                sap.m.MessageToast.show("Please select at least one batch to delete.");
                return;
            }

            var aScannedBatches = oLocalModel.getProperty("/scannedBatches") || [];

            var aSelectedObjects = aSelectedContexts.map(function (oContext) {
                return oContext.getObject();
            });

            var aRemainingBatches = aScannedBatches.filter(function (oBatch) {
                return aSelectedObjects.indexOf(oBatch) === -1;
            });

            oLocalModel.setProperty("/scannedBatches", aRemainingBatches);
            oTable.removeSelections(true);

            this._calculateTotalYield();
            sap.m.MessageToast.show(aSelectedContexts.length + " batches deleted.");
        },

        _calculateTotalYield: function () {
            var oLocalModel = this.getView().getModel("local");
            var aScannedBatches = oLocalModel.getProperty("/scannedBatches") || [];
            var fTotalQty = 0;

            // Loop through all scanned batches and sum the quantity
            aScannedBatches.forEach(function (oBatch) {
                // Parse float to ensure mathematical addition, not string concatenation
                fTotalQty += parseFloat(oBatch.qty) || 0; 
            });

            // Set the total back to the model, rounded to 2 decimal places (optional)
            oLocalModel.setProperty("/selection/yieldQty", fTotalQty.toFixed(3));
        },

        // ==========================================
        // FOOTER BUTTON ACTIONS
        // ==========================================
        onNew: function () {
            var oLocalModel = this.getView().getModel("local");
            
            oLocalModel.setProperty("/scannedBatches", []);
            oLocalModel.setProperty("/selection/plant", "");
            // oLocalModel.setProperty("/selection/salesOrder", "");
            // oLocalModel.setProperty("/selection/salesOrderItem", "");
            oLocalModel.setProperty("/selection/material", "");
            oLocalModel.setProperty("/selection/materialDescription", "");
            oLocalModel.setProperty("/selection/fromSloc", "");
            oLocalModel.setProperty("/selection/toSloc", "");
            oLocalModel.setProperty("/selection/toSalesOrder", "");
            oLocalModel.setProperty("/selection/toSalesOrderItem", "");
            
            sap.m.MessageToast.show("Screen cleared for new entry.");
        },

        // ==========================================
        // SUBMIT TO BACKEND
        // ==========================================
        onSubmit: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var oODataModel = oView.getModel();

            var oSelection = oLocalModel.getProperty("/selection");
            var aScannedBatches = oLocalModel.getProperty("/scannedBatches") || [];

            // if (!oSelection.plant || !oSelection.fromSloc || !oSelection.toSloc || !oSelection.postingDate) {
                
            //     MessageBox.error("Please fill in all mandatory details before submitting.");
            //     return;
            // }

            // if (aScannedBatches.length === 0) {
            //     MessageBox.error("Please scan at least one batch into the table.");
            //     return;
            // }

            if (!oSelection.plant || !oSelection.fromSloc || !oSelection.toSloc || !oSelection.postingDate ||
    !oSelection.toSalesOrder || !oSelection.toSalesOrderItem) {
    MessageBox.error("Please fill in all mandatory details before submitting.");
    return;
}

if (aScannedBatches.length === 0) {
    MessageBox.error("Please scan at least one batch into the table.");
    return;
}

var bInvalidItem = aScannedBatches.some(function (oBatch) {
    return !oBatch.salesOrder || !oBatch.salesOrderItem;
});

if (bInvalidItem) {
    MessageBox.error("Each line item must have Sales Order and Sales Order Item.");
    return;
}

            var oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
            var sFormattedDate = oDateFormat.format(oSelection.postingDate);
            // var sSalesOrder = oSelection.salesOrder.padStart(10, '0');
            // var sSalesOrderItem = oSelection.salesOrderItem.padStart(6, '0');
            
            // Format To fields
            var sToSalesOrder = oSelection.toSalesOrder ? oSelection.toSalesOrder.padStart(10, '0') : "";
            var sToSalesOrderItem = oSelection.toSalesOrderItem ? oSelection.toSalesOrderItem.padStart(6, '0') : "";

            // Mapping exact requested payload shape
            var aItemsPayload = aScannedBatches.map(function(oBatch) {
                return {
                    "Material": oBatch.material,
                    "Qty": String(oBatch.qty), 
                    "Unit": oBatch.uom,
                    "Batch": oBatch.batch,
                    "SalesOrder": (oBatch.salesOrder || "").trim().padStart(10, "0"),
                    "SalesOrderItem": (oBatch.salesOrderItem || "").trim().padStart(6, "0"),
                    "ToSalesOrder": (oBatch.toSalesOrder || "").trim().padStart(10, "0"),
                    "ToSalesOrderItem": (oBatch.toSalesOrderItem || "").trim().padStart(6, "0")

                    // "ToBatch": oBatch.batchTransfer || ""
                };
            });

            var oPayload = {
                "Plant": oSelection.plant,
                "PostingDate": sFormattedDate,
                "StorlocFrom": oSelection.fromSloc,
                "StorlocTo": oSelection.toSloc,
                "Remark": oSelection.remark || "",
                "_Item": aItemsPayload
            };

            oView.setBusy(true);

            // Updated endpoint to map to the exposed entity from ZSD_413E_HD
            var oListBinding = oODataModel.bindList("/ZC_413E_HD");
            var oContext = oListBinding.create(oPayload);

            oContext.created().then(function () {
                oView.setBusy(false);
                
                var sMatDoc = oContext.getProperty("MatDoc");
                var sMess = oContext.getProperty("Mess"); 
                
                if (sMatDoc && sMatDoc.trim() !== "") {
                    var sMessage = "Material Document " + sMatDoc + " created successfully!";
                    MessageBox.success(sMessage, {
                        onClose: function() {
                            oLocalModel.setProperty("/scannedBatches", []);
                            oLocalModel.setProperty("/selection/plant", "");
                            oLocalModel.setProperty("/selection/salesOrder", "");
                            oLocalModel.setProperty("/selection/salesOrderItem", "");
                            oLocalModel.setProperty("/selection/material", "");
                             oLocalModel.setProperty("/selection/materialDescription", "");
                             oLocalModel.setProperty("/selection/fromSloc", "");
            oLocalModel.setProperty("/selection/toSloc", "");
                            oLocalModel.setProperty("/selection/toSalesOrder", "");
                            oLocalModel.setProperty("/selection/toSalesOrderItem", "");
                            oLocalModel.setProperty("/selection/remark", "");
                            
                            var oPlantInput = oView.byId("inputPlant");
                            if (oPlantInput) {
                                oPlantInput.focus(); 
                            }
                        }
                    });
                } else {
                    var sBackendError = sMess ? sMess : "Backend failed to generate a Material Document.";
                    MessageBox.error("SAP Business Error: \n\n" + sBackendError);
                }

            }).catch(function (oError) {
                oView.setBusy(false);
                var sErrorMsg = "Failed to post Material Document due to a network/server error.";
                if (oError && oError.message) {
                    sErrorMsg = oError.message;
                }
                MessageBox.error(sErrorMsg);
            });
        },

        // ==========================================
        // EXPORT TO EXCEL LOGIC
        // ==========================================
        onExportExcel: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var aScannedBatches = oLocalModel.getProperty("/scannedBatches");

            // 1. Check if there is actually data to export
            if (!aScannedBatches || aScannedBatches.length === 0) {
                sap.m.MessageToast.show("There are no scanned batches to export.");
                return;
            }

            // 2. Fetch the column configuration
            var aCols = this._createColumnConfig();

            // 3. Configure the Excel document settings
            var oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level'
                },
                dataSource: aScannedBatches,      // Feed it our local JSON array
                fileName: 'Scanned_Batches.xlsx', // Name of the downloaded file
                worker: false                     // Set to false for local JSON data
            };

            // 4. Build and download the spreadsheet
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function() {
                oSheet.destroy();
            });
        },

        // Helper function to define Excel columns
        _createColumnConfig: function () {
            var EdmType = exportLibrary.EdmType;

            return [
                {
                    label: 'Material',
                    property: 'material',
                    type: EdmType.String
                },
                {
                    label: 'Batch Number',
                    property: 'batch',
                    type: EdmType.String
                },
                {
                    label: 'Description',
                    property: 'description',
                    type: EdmType.String
                },
                {
                    label: "From Storage Location",
                    property: 'fromSloc',
                    type: EdmType.String
                },
                {
                    label: "To Storage Location",
                    property: 'toSloc',
                    type: EdmType.String
                },
                {
                    label: "Sales Order",
                    property: 'salesOrder',
                    type: EdmType.String
                },
                {
                    label: "Sales Order Item",
                    property: 'salesOrderItem',
                    type: EdmType.String
                },
                {
                    label: 'Quantity',
                    property: 'qty',
                    type: EdmType.Number
                },
                {
                    label: 'Unit of Measure',
                    property: 'uom',
                    type: EdmType.String
                }
            ];
        },
    });
});