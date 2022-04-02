(function ($) {
    'use strict';
    window.Rock = window.Rock || {};
    Rock.controls = Rock.controls || {};

    Rock.controls.accountPicker = (function () {
        var AccountPicker = function (options) {
            this.options = options;
            // set a flag so that the picker only auto-scrolls to a selected item once. This prevents it from scrolling at unwanted times
            this.alreadyScrolledToSelected = false;
            this.iScroll = null;

            // this is the tree nodes that are returned from the render event in rockTree.js
            this.renderedNodes = [];

            // this keeps a collection or search mode by controlId
            this.searchControls = [];

            this.$hfItemIds = undefined;
            this.$hfExpandedIds = undefined;
            this.$hfExpandedCategoryIds = undefined;
        },
            exports;

        AccountPicker.prototype = {
            constructor: AccountPicker,
            initialize: function () {
                var $control = $('#' + this.options.controlId),
                    $tree = $control.find('.treeview'),
                    treeOptions = {
                        isPostBack: this.options.isPostBack,
                        customDataItems: this.options.customDataItems,
                        displayChildItemCountLabel: this.options.displayChildItemCountLabel,
                        enhanceForLongLists: this.options.enhanceForLongLists,
                        multiselect: this.options.allowMultiSelect,
                        categorySelection: this.options.allowCategorySelection,
                        categoryPrefix: this.options.categoryPrefix,
                        restUrl: this.options.restUrl,
                        restParams: this.options.restParams,
                        expandedIds: this.options.expandedIds,
                        expandedCategoryIds: this.options.expandedCategoryIds,
                        showSelectChildren: this.options.showSelectChildren,
                        id: this.options.startingId
                    };

                // used server-side on postback to display the selected nodes
                this.$hfItemIds = $control.find('.js-item-id-value');
                // used server-side on postback to display the expanded nodes
                this.$hfExpandedIds = $control.find('.js-initial-item-parent-ids-value');
                this.$hfExpandedCategoryIds = $control.find('.js-expanded-category-ids');

                // Custom mapping override to add features items
                this.options.mapItems = function (arr, treeView) {

                    return $.map(arr, function (item) {

                        var node = {
                            id: item.Guid || item.Id,
                            name: item.Name || item.Title,
                            iconCssClass: item.IconCssClass,
                            parentId: item.ParentId,
                            hasChildren: item.HasChildren,
                            isActive: item.IsActive,
                            countInfo: item.CountInfo,
                            isCategory: item.IsCategory
                        };

                        // Custom node properties passed in from the *Picker.cs using the ItemPicker base CustomDataItems property
                        if (treeView.options.customDataItems && treeView.options.customDataItems.length > 0) {
                            treeView.options.customDataItems.forEach(function (dataItem, idx) {
                                if (!node.hasOwnProperty(dataItem)) {
                                    node['' + dataItem.itemKey + ''] = item['' + dataItem.itemValueKey + ''];
                                }
                            });
                        }

                        if (node.parentId === null) {
                            node.parentId = '0';
                        }

                        if (item.Children && typeof item.Children.length === 'number') {

                            // traverse using the _mapArrayDefault in rockTree.js
                            node.children = _mapArrayDefault(item.Children, treeView);
                        }

                        if (node.isCategory) {
                            node.id = treeView.options.categoryPrefix + node.id;
                        }

                        return node;
                    });
                }

                if (typeof this.options.mapItems === 'function') {
                    treeOptions.mapping = {
                        mapData: this.options.mapItems
                    };
                }

                // clean up the tree (in case it was initialized already, but we are rebuilding it)
                var rockTree = $tree.data('rockTree');

                if (rockTree) {
                    rockTree.nodes = [];
                }
                $tree.empty();

                var $scrollContainer = $control.find('.scroll-container .viewport');
                var $scrollIndicator = $control.find('.track');
                this.iScroll = new IScroll($scrollContainer[0], {
                    mouseWheel: true,
                    indicators: {
                        el: $scrollIndicator[0],
                        interactive: true,
                        resize: false,
                        listenY: true,
                        listenX: false,
                    },
                    click: false,
                    preventDefaultException: { tagName: /.*/ }
                });

                // Since some handlers are "live" events, they need to be bound before tree is initialized
                this.initializeEventHandlers();

                if (this.$hfItemIds.val() && this.$hfItemIds.val() !== '0') {
                    treeOptions.selectedIds = this.$hfItemIds.val().split(',');
                    this.addSelectedNodes(treeOptions.selectedIds, 'selected');
                }

                if (this.$hfExpandedIds.val()) {
                    treeOptions.expandedIds = this.$hfExpandedIds.val().split(',');
                    this.addSelectedNodes(treeOptions.expandedIds, 'expand-collapse')
                }

                if (this.$hfExpandedCategoryIds.val()) {
                    treeOptions.expandedCategoryIds = this.$hfExpandedCategoryIds.val().split(',');
                }

                // Initialize the rockTree and pass the tree options also makes http fetches
                $tree.rockTree(treeOptions);

                this.updateScrollbar();
            },
            initializeEventHandlers: function () {
                var self = this,
                    $control = $('#' + this.options.controlId),
                    $spanNames = $control.find('.selected-names');

                self.$hfItemIds = $control.find('.js-item-id-value');
                self.$hfItemNames = $control.find('.js-item-name-value');

                // clear session storage
                $(document).ready(function () {
                    if (!self.options.isPostBack) {
                        self.removeTreeState();
                    }
                });

                // Bind tree events
                $control.find('.treeview')
                    .on('rockTree:selected', function (e) {

                        // set\remove selected item
                        var $treeItems = $(self.getTreeState(true));

                        $treeItems.find('li').each(function (i, v) {
                            var selectedId = $(v).find('.selected').parent().attr('data-id');

                            if (selectedId) {
                                self.addSelectedNodes(selectedId, 'selected');
                            }
                            else {
                                var notSelectedId = $(v).find('.rocktree-name').parent().attr('data-id');
                                self.removeSelectedNodes(notSelectedId, 'selected')
                            }
                        });

                        if (self.getSelectedNodes().length > 0) {
                            $('#btnPreviewSelection_' + self.options.controlId).show();
                            $('#btnTreeView_' + self.options.controlId).hide();
                        }
                        else {
                            $('#btnPreviewSelection_' + self.options.controlId).hide();
                            $('#btnTreeView_' + self.options.controlId).hide();

                            self.removeSelectedNodes();
                        }

                        self.setTreeState();
                    })
                    .on('rockTree:itemClicked', function (e, data) {
                        // make sure it doesn't auto-scroll after something has been manually clicked
                        self.alreadyScrolledToSelected = true;
                        if (!self.options.allowMultiSelect) {
                            $control.find('.picker-btn').trigger('click');
                        }
                    })
                    .on('rockTree:expand rockTree:collapse rockTree:dataBound', function (evt, data) {
                        var $treeItems = $(self.getTreeState(true));
                        // set\remove expanded items
                        $treeItems.find('[node-open]').each(function (i, v) {
                            var opened = $(v).attr('node-open') === 'true' ? true : false;
                            var nodeId = $(v).attr('data-id');

                            if (opened) {
                                self.addSelectedNodes(nodeId, 'expand-collapse');
                            }
                            else {
                                self.removeSelectedNodes(nodeId, 'expand-collapse');
                            }
                        });

                        self.setTreeState();
                        self.rebuildTreeSelections();
                        self.updateScrollbar();
                    })
                    .on('rockTree:rendered', function (evt, data) {
                        self.renderedNodes = data.nodes;

                        if (self.$hfItemIds.val() && self.$hfItemIds !== '0') {
                            self.options.selectedIds = self.$hfItemIds.val().split(',');
                            self.addSelectedNodes(self.options.selectedIds);
                        }

                        var $ul = $(data.$ul);

                        $('#btnPreviewSelection_' + self.options.controlId).hide();
                        $('#btnTreeView_' + self.options.controlId).hide();

                        // Add any modifications to the rendered tree
                        self.traverseAndModifyTree($ul);

                        self.scrollToSelectedItem();

                        // Render the search control if EnhanceForLongLists is true from the server
                        self.createSearchControl();

                        // Store the original rendered HTML for later reference
                        // Used throughout to restore the tree to the original state if having to present different UI modes

                        //if (!self.getTreeState()) {
                        //    self.setTreeState();
                        //}

                        //$control.find('.treeview').trigger('rockTree:selected');

                        //reset this after render
                        console.debug('rendered->isPostBack', self.options.isPostBack);
                    })
                    .on('rockTree:fetchCompleted', function (evt, data) {
                        // intentionally empty
                    });

                $control.find('a.picker-label').on('click', function (e) {
                    e.preventDefault();
                    $(this).toggleClass("active");
                    $control.find('[class^="picker-menu"]').first().toggle(0, function () {
                        self.scrollToSelectedItem();
                    });
                });

                $control.find('.picker-cancel').on('click', function () {

                    var $treeItems = $(self.getTreeState());

                    $treeItems.find('.rocktree-name').removeClass('selected');

                    // clear search input & show
                    $control.find('.item-picker-search > input').val('');
                    $control.find('.js-existing-search-value').val('');
                    $control.find('.item-picker-search').show();

                    // clear selected items
                    self.removeSelectedNodes(undefined, 'selected');
                    self.removeSelectedNodes(undefined, 'expand-collapse');

                    $(this).removeClass("active");
                    $(this).closest('[class^="picker-menu"]').toggle(0, function () {
                        self.updateScrollbar();
                    });
                    $(this).closest('a.picker-label').removeClass("active");

                    // Update the stored HTML state with the selection changes
                    self.setTreeState($treeItems.outerHTML());

                    // render the tree HTML from state
                    self.showTreeState();
                });

                // Preview Selection link click
                $control.find('.picker-preview').on('click', function () {

                    $control.find('.item-picker-search').hide();

                    // Hide the search input
                    if (self.options.allowMultiSelect) {

                        $('#btnPreviewSelection_' + self.options.controlId).hide();
                        $('#btnTreeView_' + self.options.controlId).show();
                        $('#' + self.options.controlId + '_btnSelectAll').hide();

                        var $treeItems = $('#' + self.options.controlId + '_treeItems');

                        // Store so we can reset on the [TreeView] link click
                        self.setTreeState($treeItems);

                        var $itemTree = $control.find(".rocktree-item");

                        var selectedData = [];
                        var notSelectedData = [];

                        if ($itemTree) {

                            $itemTree.each(function (index, value) {
                                var $value = $(value);

                                var selected = $('#' + value.id + ' > .rocktree-name').hasClass('selected');

                                var title = $('#' + value.id + ' > .rocktree-name').attr('title');
                                var dataId = $value.attr('data-id');
                                var dataParentId = $value.attr('data-parent-id');
                                var glCode = $value.attr('gl-code');

                                if (!glCode) {
                                    glCode = '';
                                }

                                var toAdd = {
                                    id: dataId,
                                    parentId: dataParentId,
                                    name: title,
                                    glcode: glCode,
                                    isChild: parseInt(dataParentId) > 0,
                                    children: []
                                };

                                var foundItem = false;

                                // Build a list of selected items
                                if (selected) {

                                    // Items with .selected class
                                    foundItem = Rock.utility.objectHasValue(selectedData, 'id', dataId);

                                    if (!foundItem) {
                                        toAdd.selected = true;
                                        selectedData.push(toAdd);
                                    }
                                }
                                else {

                                    // Items without  .selected class
                                    foundItem = Rock.utility.getObject(notSelectedData, 'id', dataId);

                                    if (!foundItem) {
                                        toAdd.selected = false;
                                        notSelectedData.push(toAdd);
                                    }
                                }
                            });

                            // Loop through the missing parent items and add them to the 'selected' items array if a match is found so we can represent the ui correctly
                            var lastSelectedItemsCount = 0;
                            var populateMissingItems = function () {

                                if (selectedData) {
                                    lastSelectedItemsCount = selectedData.length;
                                    selectedData.forEach(function (selItem) {

                                        // Run through the un-selected items and they are parents to the selected items we need to add them to the selectedData array
                                        if (notSelectedData) {
                                            notSelectedData.forEach(function (missing) {
                                                if (missing && missing.id === selItem.parentId) {
                                                    if (!Rock.utility.objectHasValue(selectedData, 'id', missing.id)) {
                                                        selectedData.push(missing);
                                                    }
                                                }
                                            });
                                        }
                                    });

                                    if (lastSelectedItemsCount < selectedData.length) {
                                        populateMissingItems();
                                    }
                                }
                            }

                            // Start filling out the missing parents if only child items were selected
                            populateMissingItems();

                            // Build a new tree of selected items
                            var newTree = Rock.utility.listToTree(selectedData);

                            var pathList = [];
                            var maxPathLength = 0;
                            var pathTraverse = function (node, path) {
                                if (!path) {
                                    path = [];
                                }

                                if (node.name) {
                                    path.push({ name: node.name })
                                }

                                if (path.length > maxPathLength) {
                                    maxPathLength = path.length;
                                }

                                var pathObj = {
                                    nodeId: node.id,
                                    isChild: node.isChild,
                                    name: node.glcode.length > 0 ? node.name + ' (' + node.glcode + ')' : node.name,
                                    title: node.name,
                                    length: path.length,
                                    path: path.map(function (n) { return n.name }).join('^'),
                                    selected: node.selected
                                };

                                pathList.push(pathObj);

                                if (node.children) {
                                    node.children.forEach(function (item) {
                                        pathTraverse(item, path.slice());
                                    });
                                }
                            }

                            var previewData = [];

                            newTree.forEach(function (node) {

                                // build the displayed subtitle path list
                                pathTraverse(node, []);

                                if (pathList) {

                                    previewData = JSON.parse(JSON.stringify(pathList)); //deep-copy

                                    // Get the list of paths we want by the root node and path length
                                    if (previewData) {

                                        previewData = Rock.utility.getObjects(previewData, 'selected', true);

                                    }
                                }

                                maxPathLength = 0;
                            });

                            if (previewData) {
                                var listHtml = '';
                                previewData.forEach(function (node) {

                                    listHtml +=
                                        '<div id="preview-item-' + node.nodeId + '" class="container-fluid">' +
                                        '      <div class="row">' +
                                        '        <div class="col-xs-10">' +
                                        '             <li class="rocktree-item rocktree-folder rocktree-preview-item">' +
                                        '            <span class="rocktree-name" title="' + node.title + '">' +
                                        '              <h5><span class="rocktree-node-name-text text-color">' + node.name + '</span><br/>' +
                                        '              <span class="text-muted"><small>' + node.path.replaceAll('^', '<i class="fa fa-chevron-right pl-1 pr-1" aria-hidden="true"></i>') + '</small></span></h5>' +
                                        '            </span>' +
                                        '         </li>' +
                                        '       </div>' +
                                        '       <div class="col-xs-2 pt-2">' +
                                        '         <a id="lnk-remove-preview-' + node.nodeId + '" title="Remove From Preview" class="btn btn-link text-muted"> <i class="fa fa-times"></i></a>' +
                                        '       </div>' +
                                        ' </div>' +
                                        '</div>';
                                });


                                // Display preview list
                                var listHtmlView = '<ul class="rocktree">' +
                                    listHtml +
                                    '</ul>';

                                $('#' + self.options.controlId + '_treeItems').html(listHtmlView);
                                // Wire up remove event and remove from dataset
                                previewData.forEach(function (node) {

                                    $('#lnk-remove-preview-' + node.nodeId).on('click', function (e) {

                                        $('#preview-item-' + node.nodeId).remove();

                                        self.removeSelectedNodes(node.nodeId);

                                        previewData = previewData.filter(function (fNode) {
                                            return fNode.nodeId !== node.nodeId;
                                        });

                                        // Re-select the items on the tree if it have removed them all
                                        if (!previewData || previewData.length === 0) {
                                            self.showTreeState();
                                            $control.find('.item-picker-search').show();
                                            self.rebuildTreeSelections();
                                        }
                                    });
                                });
                            }
                        }
                    }
                });

                // Tree View link click
                $control.find('.picker-treeview').on('click', function () {

                    self.removeSearchControl();

                    var rockTree = $control.find('.treeview').data('rockTree');

                    // rebind the original click event in rockTree.js so the tree selection
                    // functions as normal when not in search mode
                    // this event could become unbound in the search mode and then not be rebound before the treeview is clicked
                    rockTree.rebindEvent('click', '.rocktree-item > span', 'onSelectHandler');

                    //clear search input
                    $control.find('.item-picker-search > input').val('');
                    $control.find('.js-existing-search-value').val('');

                    if (self.getSelectedNodes().length > 0) {
                        $control.find('.picker-preview').show();
                    }
                    else {
                        $control.find('.picker-preview').hide();
                    }

                    $control.find('.picker-treeview').hide();

                    $('#' + self.options.controlId + '_btnSelectAll').show();

                    self.rebuildTreeSelections();

                    $control.find('.item-picker-search').show();
                    //$control.find('.treeview').trigger('rockTree:selected');
                });

                // have the X appear on hover if something is selected
                if (this.$hfItemIds.val() && this.$hfItemIds.val() !== '0') {
                    $control.find('.picker-select-none').addClass('rollover-item');
                    $control.find('.picker-select-none').show();
                }

                // [Select] button click
                $control.find('.picker-btn').on('click', function (el) {

                    var rockTree = $control.find('.treeview').data('rockTree'),
                        selectedNodes = rockTree.selectedNodes,
                        selectedIds = [],
                        selectedNames = [];

                    $.each(selectedNodes, function (index, node) {
                        var nodeName = $("<textarea/>").html(node.name).text();

                        selectedNames.push(nodeName);
                        if (!selectedIds.includes(node.id)) {
                            selectedIds.push(node.id);
                        }
                    });

                    self.$hfItemIds.val(selectedIds.join(',')).trigger('change'); // .trigger('change') is used to cause jQuery to fire any "onchange" event handlers for this hidden field.
                    self.$hfItemNames.val(selectedNames.join(','));

                    // have the X appear on hover. something is selected
                    $control.find('.picker-select-none').addClass('rollover-item');
                    $control.find('.picker-select-none').show();

                    $spanNames.text(selectedNames.join(', '));
                    $spanNames.attr('title', $spanNames.text());

                    $(this).closest('a.picker-label').toggleClass("active");
                    $(this).closest('[class^="picker-menu"]').toggle(0, function () {
                        self.updateScrollbar();
                    });

                    if (!(el && el.originalEvent && el.originalEvent.srcElement === this)) {
                        // if this event was called by something other than the button itself, make sure the execute the href (which is probably javascript)
                        var jsPostback = $(this).attr('href');
                        if (jsPostback) {
                            window.location = jsPostback;
                        }
                    }
                });

                $control.find('.picker-select-none').on('click', function (e) {
                    e.stopImmediatePropagation();
                    var rockTree = $control.find('.treeview').data('rockTree');
                    rockTree.clear();

                    self.$hfItemIds.val('0').trigger('change'); // .trigger('change') is used to cause jQuery to fire any "onchange" event handlers for this hidden field.
                    self.$hfItemNames.val('');

                    // don't have the X appear on hover. nothing is selected
                    $control.find('.picker-select-none').removeClass('rollover-item');
                    $control.find('.picker-select-none').hide();

                    $control.siblings('.js-hide-on-select-none').hide();

                    $spanNames.text(self.options.defaultText);
                    $spanNames.attr('title', $spanNames.text());
                });

                // clicking on the 'select all' btn
                $control.on('click', '.js-select-all', function (e) {
                    var rockTree = $control.find('.treeview').data('rockTree');

                    e.preventDefault();
                    e.stopPropagation();

                    var $itemNameNodes = rockTree.$el.find('.rocktree-name');

                    var allItemNodesAlreadySelected = true;
                    $itemNameNodes.each(function (a) {
                        if (!$(this).hasClass('selected')) {
                            allItemNodesAlreadySelected = false;
                        }
                    });

                    if (!allItemNodesAlreadySelected) {
                        // mark them all as unselected (just in case some are selected already), then click them to select them
                        $itemNameNodes.removeClass('selected');

                        $itemNameNodes.trigger('click');

                        $('#btnPreviewSelection_' + self.options.controlId).show();
                        $('#btnTreeView_' + self.options.controlId).hide();

                    } else {
                        // if all were already selected, toggle them to unselected
                        rockTree.setSelected([]);
                        $itemNameNodes.removeClass('selected');

                        $('#btnPreviewSelection_' + self.options.controlId).hide();
                        $('#btnTreeView_' + self.options.controlId).hide();
                    }
                });
            },
            updateScrollbar: function (sPosition) {
                var self = this;
                // first, update this control's scrollbar, then the modal's
                var $container = $('#' + this.options.controlId).find('.scroll-container');

                if ($container.is(':visible')) {
                    if (!sPosition) {
                        sPosition = 'relative'
                    }
                    if (self.iScroll) {
                        self.iScroll.refresh();
                    }
                }

                // update the outer modal
                Rock.dialogs.updateModalScrollBar(this.options.controlId);
            },
            scrollToSelectedItem: function () {
                var $selectedItem = $('#' + this.options.controlId + ' [class^="picker-menu"]').find('.selected').first();
                if ($selectedItem.length && (!this.alreadyScrolledToSelected)) {
                    this.updateScrollbar();
                    this.iScroll.scrollToElement('.selected', '0s');
                    this.alreadyScrolledToSelected = true;
                } else {
                    // initialize/update the scrollbar
                    this.updateScrollbar();
                }
            },
            // Make tree modifications here
            traverseAndModifyTree: function (ul) {

                var self = this;

                // Loop through each <li> item
                ul.find('li').each(function (idx, val) {
                    var $li = $(val);

                    var foundNode = Rock.utility.getObject(self.renderedNodes, 'id', $li.attr('data-id'));
                    if (foundNode) {
                        if (foundNode.glCode) {
                            //set the gl code
                            $li.attr('gl-code', foundNode.glCode);
                            var text = $li.find('.rocktree-name').first().attr('title');
                            $li.find('.rocktree-node-name-text').first().text(text.replace(text, text + ' (' + foundNode.glCode + ')'))
                        }
                    }
                    var $nextUl = $li.children('ul');
                    if ($nextUl) {
                        self.traverseAndModifyTree($nextUl, self.renderedNodes);
                    }
                });
            },
            createSearchControl: function () {
                var self = this;
                var controlId = self.options.controlId;

                var $control = $('#' + controlId);

                var rockTree = $control.find('.treeview').data('rockTree');

                if (self.options.enhanceForLongLists === true) {
                    var searchInputControl = '#' + controlId + '_itemPickerSearchInput';

                    // A hidden value to store the current search criteria to be read on post-backs
                    var $searchValueField = $('.js-existing-search-value');

                    var searchControl =
                        '<div id="' + controlId + '_itemPickerSearch">' +
                        '  <div class="input-group item-picker-search">' +
                        '    <input id="' + controlId + '_itemPickerSearchInput" class="form-control form-control-override" type="text" autocomplete="on" />' +
                        '      <div class="input-group-addon input-group-addon-override">' +
                        '        <i class="fa fa-search text-gray-600"></i>' +
                        '      </div>' +
                        '  </div>' +
                        '  <div id="' + controlId + '_treeItems' + '">' +
                        '</div>';

                    // Get all of the rendered items
                    var itemsHtml = $('#' + controlId + ' .treeview-items').html();
                    $('#' + controlId + ' .treeview-items').html("");

                    // Add the search control after rendering
                    $('#' + controlId + ' .treeview').prepend(searchControl);
                    $('#' + controlId + '_treeItems').append(itemsHtml);

                    // Handle the input searching
                    $(searchInputControl).keyup(function (keyEvent) {
                        var that = this;
                        var $allListElements = $('#' + controlId + '_itemPickerSearch ul > li');

                        //set hidden search value to restore
                        $searchValueField.val($(searchInputControl).val());

                        if ($(searchInputControl).val().length > 0) {

                            $control.find('.picker-treeview').show();

                            $control.find('.picker-preview').hide();

                            /*** Enter Search mode ***/

                            // push control to the array to keep track when we are in search mode
                            self.setSearchControl();

                            // find the matching elements
                            var $matchingListElements = $allListElements
                                .filter(function (i, li) {
                                    var listItemText = $(li).text().toUpperCase(),
                                        searchText = that.value.toUpperCase();
                                    return ~listItemText.indexOf(searchText);
                                });

                            // unbinds the current click event on the rocktree so our checkboxes and radio buttons work
                            // since e.preventDefault is used in the underlying rockTree.js $el.on call
                            // You can access the handlerInfo via the rockTree.handlerInfo prop which is stored as an object like below
                            //    {event: 'click', name: 'onSelectHandler', selector: '.rocktree-item > span', handler: ƒ}
                            rockTree.unbindEvent('click', '.rocktree-item > span', 'onSelectHandler');
                        }
                        else {
                            $control.find('.picker-treeview').hide();
                            /*** Exit Search mode ***/

                            // we are no longer in search mode if the text is empty so remove it from the array
                            self.removeSearchControl();

                            // rebind the original click event in rockTree.js so the tree selection
                            // functions as normal when not in search mode
                            rockTree.rebindEvent('click', '.rocktree-item > span', 'onSelectHandler');

                            // revert to original rendered HTML
                            self.rebuildTreeSelections();
                        }

                        if ($matchingListElements) {
                            $matchingListElements.each(function (treeItemKey, treeItem) {

                                var nodeId = $(treeItem).attr('data-id');

                                var $rockTreeName = $(treeItem).find('.rocktree-name').first();
                                var $rockTreeNodeName = $(treeItem).find('.rocktree-node-name-text').first();

                                // remove the folder icon we are reusing the current container
                                $(treeItem).find('.rocktree-name > .fa-file-o').remove();

                                var $searchInputCheckbox = $rockTreeNodeName.find('.rock-tree-input-cb > input');
                                var $searchInputRadioOption = $rockTreeNodeName.find('.rock-tree-input-rb > input');

                                if (self.options.allowMultiSelect) {
                                    // check boxes if using multi-select picker
                                    if (!$searchInputCheckbox.length) {
                                        $rockTreeNodeName.prepend('<span class="pr-2 rock-tree-input-cb"><input class="js-node-check-box" data-id="' + nodeId + '" type="checkbox"></span>');
                                    }

                                    $searchInputCheckbox = $rockTreeNodeName.find('.rock-tree-input-cb > input');

                                    // set the checked value if the tree-view item is selected
                                    if ($rockTreeName.hasClass('selected')) {
                                        $searchInputCheckbox.attr('checked', 'checked');
                                        $searchInputCheckbox.trigger('checked');
                                    }
                                }
                                else {
                                    // otherwise use radio options for single select
                                    if (!$searchInputRadioOption.length) {
                                        $rockTreeNodeName.prepend('<span class="pr-2 rock-tree-input-rb"><input class="js-node-radio-button" data-id="' + nodeId + '" type="radio"></span>');
                                    }

                                    $searchInputRadioOption = $rockTreeNodeName.find('.rock-tree-input-rb > input');

                                    // set the radio value if the tree-view item is selected
                                    if ($rockTreeName.hasClass('selected')) {
                                        $searchInputRadioOption.prop('checked', true);
                                        $searchInputRadioOption.trigger('checked');
                                    }
                                }

                                // we don't need this class to show in the search mode
                                $rockTreeName.removeClass('selected');
                            });

                            $allListElements.hide();
                            $matchingListElements.show();

                            // Check-box selection event
                            $('.rock-tree-input-cb > input').off().on('change', function (e) {
                                var checked = this.checked;
                                var $this = $(this);

                                if (checked) {
                                    self.addSelectedNodes($this.attr('data-id'), 'selected')
                                }
                                else {
                                    self.removeSelectedNodes($this.attr('data-id'), 'selected')
                                }
                            });

                            // Radio option selection event
                            $('.rock-tree-input-rb > input').off().on('change', function (e) {
                                var checked = this.checked;
                                var $this = $(this);
                                var nodeId = $this.attr('data-id');

                                $('.rock-tree-input-rb > input').removeAttr('checked');
                                self.removeSelectedNodes();

                                if (checked) {
                                    self.addSelectedNodes(nodeId, 'selected')
                                    $this.prop('checked', true);
                                }
                                else {
                                    self.removeSelectedNodes(nodeId, 'selected')
                                }
                            });
                        }

                        console.debug('search control created');
                    });

                    // Check for existing input val (likely on postbacks) then set the search value and fire the search
                    var existingVal = $searchValueField.val();
                    if (existingVal && existingVal.length > 0) {
                        $(searchInputControl).val(existingVal);
                        $(searchInputControl).trigger('keyup');
                    }
                }
            },
            addSelectedNodes: function (idOrIds, type) {

                if (!type) {
                    type = 'selected';
                }
                var self = this;

                var $ids = undefined;
                var selectedProp = '';
                var skipSelectedCheck = false;

                if (type === 'selected') {
                    $ids = self.$hfItemIds;
                    selectedProp = 'selectedIds';
                }

                if (type === 'expand-collapse') {
                    $ids = self.$hfExpandedIds;
                    selectedProp = 'expandedIds';
                }

                if (self.getSelectedNodes(type) || skipSelectedCheck) {
                    if ($.isArray(idOrIds)) {

                        idOrIds.forEach(function (id) {
                            if (self.options[selectedProp].indexOf(id) === -1) {
                                self.options[selectedProp].push(id);
                            }
                        });

                        self.options[selectedProp] = self.options[selectedProp].filter(
                            function (id) {
                                return idOrIds.indexOf(id) >= 0;
                            });
                    }
                    else {
                        if (self.options[selectedProp].indexOf(idOrIds) === -1) {
                            self.options[selectedProp].push(idOrIds);
                        }
                    }

                    if (self.options[selectedProp]) {
                        $ids.val(self.options[selectedProp].join(','));
                    }
                }

                if (type === 'selected') {
                    self.$hfItemIds = $ids;
                }

                if (type === 'expand-collapse') {
                    self.$hfExpandedIds = $ids;
                }
            },
            getSelectedNodes: function (type) {
                if (!type) {
                    type = 'selected';
                }
                var self = this;

                var $ids = undefined;
                var selectedProp = '';

                if (type === 'selected') {
                    $ids = self.$hfItemIds;
                    selectedProp = 'selectedIds';
                }

                if (type === 'expand-collapse') {
                    $ids = self.$hfExpandedIds;
                    selectedProp = 'expandedIds';
                }

                if (!$ids) {
                    return [];
                }

                if ($ids.val() && $ids.val() !== '0') {
                    var ids = $ids.val().split(',');
                    self.options[selectedProp] = ids;
                }
                else {
                    $ids.val('0');
                    self.options[selectedProp] = [];
                }


                if (type === 'selected') {
                    self.$hfItemIds = $ids;
                }

                if (type === 'expand-collapse') {
                    self.$hfExpandedIds = $ids;
                }

                var nodeIds = self.options[selectedProp];

                console.debug('getSelectedNodes->' + type, nodeIds)

                return nodeIds;
            },
            removeSelectedNodes: function (idOrIds, type) {
                var self = this;

                if (!type) {
                    type = 'selected';
                }

                var $ids = undefined;
                var selectedProp = '';

                if (type === 'selected') {
                    $ids = self.$hfItemIds;
                    selectedProp = 'selectedIds';
                }

                if (type === 'expand-collapse') {
                    $ids = self.$hfExpandedIds;
                    selectedProp = 'expandedIds';
                }

                if (!$ids) {
                    return;
                }

                if (!idOrIds) {
                    $ids.val('0');
                    self.$hfItemIds.val('0');
                    self.$hfExpandedIds.val('0');
                    self.options[selectedProp] = [];
                }

                if (self.getSelectedNodes(type)) {
                    if ($.isArray(idOrIds)) {
                        self.options[selectedProp] = self.options[selectedProp].filter(function (fVal) {
                            return !(idOrIds.indexOf(fVal) >= 0);
                        });
                    }
                    else {
                        self.options[selectedProp] = self.options[selectedProp].filter(function (v) {
                            return v !== idOrIds;
                        });
                    }

                    //set the ids passed to the service on postbacks
                    $ids.val(self.options[selectedProp].join(','));
                }
                else {
                    $ids.val('');
                }

                if (type === 'selected') {
                    self.$hfItemIds = $ids;
                }

                if (type === 'expand-collapse') {
                    self.$hfExpandedIds = $ids;
                }
            },
            hasSearchControl: function () {
                var self = this;
                var isSearchCtl = false;
                if (self.searchControls) {
                    isSearchCtl = self.searchControls.indexOf('search-mode-' + self.options.controlId) >= 0;
                }
                return isSearchCtl;
            },
            setSearchControl: function () {
                var self = this;
                if (!self.hasSearchControl()) {
                    self.searchControls.push('search-mode-' + self.options.controlId);
                }
            },
            removeSearchControl: function () {
                var self = this;

                if (self.hasSearchControl()) {
                    self.searchControls = self.searchControls.filter(function (v) {
                        return v !== 'search-mode-' + self.options.controlId;
                    });
                }
            },
            setTreeState: function (optionalTreeHtml) {
                var self = this;

                // do not store the tree state on postback because we could be in a weird state
                if (self.options.isPostBack === true) {
                    return;
                }

                var html = null;

                if (optionalTreeHtml !== undefined && optionalTreeHtml !== null) {

                    if (Rock.utility.isDomElement(optionalTreeHtml)) {
                        html = optionalTreeHtml.outerHTML();
                    }
                    else {
                        html = optionalTreeHtml;
                    }
                }
                else {
                    var el = $('#' + self.options.controlId + '_treeItems');
                    if (el.length) {
                        html = $('#' + self.options.controlId + '_treeItems').outerHTML();
                    }
                }

                if (html !== null) {
                    // per tab\session storage
                    var storageKey = self.options.controlId + '-treeview-html';
                    var sessionItem = Rock.utility.encodeUnicode(html);
                    sessionStorage.setItem(storageKey, sessionItem);
                }
            },
            getTreeState: function (useTreeItemsElementHtml) {
                var self = this;

                if (useTreeItemsElementHtml) {
                    return $('#' + self.options.controlId + '_treeItems').outerHTML();
                }

                var storageKey = self.options.controlId + '-treeview-html';
                var sessionItem = sessionStorage.getItem(storageKey);
                if (sessionItem) {
                    var html = Rock.utility.decodeUnicode(sessionItem);
                    return html;
                }

                return undefined;
            },
            showTreeState: function () {
                var self = this;

                $('#' + self.options.controlId + '_treeItems').outerHTML(self.getTreeState());
            },
            removeTreeState: function () {
                var self = this;
                var storageKey = self.options.controlId + '-treeview-html';

                if (self.getTreeState()) {
                    sessionStorage.removeItem(storageKey);
                }
            },
            rebuildTreeSelections: function () {

                console.debug('rebuildTreeSelections');

                var self = this;

                var searchMode = self.hasSearchControl();

                if (!searchMode) {
                    var $treeState = $(self.getTreeState());

                    $treeState.find('.rocktree-name').removeClass('selected');

                    // reselect selected nodes
                    if (self.getSelectedNodes('selected')) {
                        self.getSelectedNodes('selected').forEach(function (id) {
                            var $nodeToSelect = $treeState.find('#node-item-' + id).find('.rocktree-name').first();

                            if ($nodeToSelect.length) {
                                $nodeToSelect.addClass('selected');
                            }
                        });
                    }

                    // reselect selected nodes
                    if (self.getSelectedNodes('expand-collapse')) {
                        self.getSelectedNodes('expand-collapse').forEach(function (id) {
                            var $nodeToExpand = $treeState.find('#node-item-' + id);
                            if ($nodeToExpand.length) {
                                $nodeToExpand.attr('node-open', true);
                            }
                        });
                    }

                    self.setTreeState($treeState.outerHTML());
                    self.showTreeState();
                }
                else {

                    if ($('.rock-tree-input-cb').length) {
                        $('.rock-tree-input-cb').removeAttr('checked');

                        // reselect selected nodes
                        if (self.getSelectedNodes('selected')) {
                            self.getSelectedNodes('selected').forEach(function (id) {
                                var $nodeToCheck = $('#node-item-' + id).find('.rocktree-name').first();

                                var $cbToCheck = $nodeToCheck.find('input');
                                $cbToCheck.attr('checked', 'checked');
                            });
                        }
                    }

                    if ($('.rock-tree-input-rb').length) {
                        $('.rock-tree-input-rb').removeAttr('checked');
                        // reselect selected nodes
                        if (self.getSelectedNodes('selected')) {
                            self.getSelectedNodes('selected').forEach(function (id) {
                                var $nodeToCheck = $('#node-item-' + id).find('.rocktree-name').first();

                                var $rbToCheck = $nodeToCheck.find('input');
                                $rbToCheck.prop('checked', true);
                            });
                        }
                    }
                }

                // when need to turn this back off after a postback and the search control has been created and invoked
                self.options.isPostBack = false;
            }
        }

        // jquery function to ensure HTML is state remains the same each time it is executed
        $.fn.outerHTML = function (s) {
            return (s)
                ? this.before(s).remove()
                : $("<p>").append(this.eq(0).clone()).html();
        }

        exports = {
            defaults: {
                id: 0,
                controlId: null,
                restUrl: null,
                restParams: null,
                allowCategorySelection: false,
                categoryPrefix: '',
                allowMultiSelect: false,
                defaultText: '',
                selectedIds: null,
                expandedIds: null,
                expandedCategoryIds: null,
                showSelectChildren: false,
                enhanceForLongLists: false,
                displayChildItemCountLabel: false,
                customDataItems: [],
                isPostBack: false
            },
            controls: {},
            initialize: function (options) {
                var settings,
                    itemPicker;

                if (!options.controlId) {
                    throw 'controlId must be set';
                }

                if (!options.restUrl) {
                    throw 'restUrl must be set';
                }

                settings = $.extend({}, exports.defaults, options);

                if (!settings.defaultText) {
                    settings.defaultText = exports.defaults.defaultText;
                }

                itemPicker = new AccountPicker(settings);
                exports.controls[settings.controlId] = itemPicker;
                itemPicker.initialize();
            }
        };

        return exports;
    }());
}(jQuery));

