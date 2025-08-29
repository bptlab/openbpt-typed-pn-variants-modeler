export const Events = {
  // Disclaimer: This is not a full list of events defined by diagram-js but only
  // the subset that is used within this project.

  // auto-place
  AUTO_PLACE: 'autoPlace',
  AUTO_PLACE_START: 'autoPlace.start',
  AUTO_PLACE_END: 'autoPlace.end',

  // copy / paste
  COPY_ELEMENT: 'copyPaste.copyElement',
  PASTE_ELEMENT: 'copyPaste.pasteElement',

  // import / diagram
  IMPORT_PARSE_START: 'import.parse.start',
  IMPORT_RENDER_START: 'import.render.start',
  IMPORT_RENDER_COMPLETE: 'import.render.complete',
  IMPORT_DONE: 'import.done',
  IMPORT_PARSE_FAILED: 'import.parse.failed',
  DIAGRAM_INIT: 'diagram.init',
  DIAGRAM_DESTROY: 'diagram.destroy',
  DIAGRAM_ELEMENT_ADDED: 'diagramElement.added',

  // export
  SAVE_XML_START: 'saveXML.start',
  SAVE_XML_SERIALIZED: 'saveXML.serialized',
  SAVE_XML_DONE: 'saveXML.done',
  SAVE_SVG_START: 'saveSVG.start',
  SAVE_SVG_DONE: 'saveSVG.done',

  // properties panel
  PROPERTIES_PANEL_ATTACH: 'propertiesPanel.attach',
  PROPERTIES_PANEL_DETACH: 'propertiesPanel.detach',
  PROPERTIES_PANEL_GET_PROVIDERS: 'propertiesPanel.getProviders',
  PROPERTIES_PANEL_PROVIDERS_CHANGED: 'propertiesPanel.providersChanged',
  PROPERTIES_PANEL_SET_LAYOUT: 'propertiesPanel.setLayout',
  PROPERTIES_PANEL_RENDERED: 'propertiesPanel.rendered',
  PROPERTIES_PANEL_DESTROYED: 'propertiesPanel.destroyed',
  PROPERTIES_PANEL_UPDATED: 'propertiesPanel.updated',
  PROPERTIES_PANEL_LAYOUT_CHANGED: 'propertiesPanel.layoutChanged',
  PROPERTIES_PANEL_DESCRIPTION_LOADED: 'propertiesPanel.descriptionLoaded',
  PROPERTIES_PANEL_TOOLTIP_LOADED: 'propertiesPanel.tooltipLoaded',

  // popup menu
  POPUP_MENU_OPEN: 'popupMenu.open',

  // keyboard
  KEYBOARD_BIND: 'keyboard.bind',
  KEYBOARD_UNBIND: 'keyboard.unbind',

  // command stack changes
  COMMANDSTACK_CHANGED: 'commandStack.changed',

  // navigation
  CANVAS_VIEWBOX_CHANGING: 'canvas.viewbox.changing',

  // modeling / editing
  ROOT_ADDED: 'root.added',
  HOVER_ELEMENT: 'element.hover',
  SELECTION_CHANGED: 'selection.changed',
  ELEMENT_DBLCLICK: 'element.dblclick',
  ELEMENT_MOUSEDOWN: 'element.mousedown',
  DIRECT_EDITING_ACTIVATE: 'directEditing.activate',
  CREATE_END: 'create.end',
  SHAPE_CHANGED: 'shape.changed',
  ELEMENTS_CHANGED: 'elements.changed',
  DRAG_INIT: 'drag.init',

  // element templates
  ELEMENT_TEMPLATES_CHANGED: 'elementTemplates.changed',

  // moddle copy hooks
  MODDLECOPY_CAN_COPY_PROPERTIES: 'moddleCopy.canCopyProperties',
  MODDLECOPY_CAN_COPY_PROPERTY: 'moddleCopy.canCopyProperty',
  MODDLECOPY_CAN_SET_COPIED_PROPERTY: 'moddleCopy.canSetCopiedProperty',

  // simulation
  TOGGLE_MODE_EVENT: 'tokenSimulation.toggleMode',
  FIRE_TRANSITION_EVENT: 'tokenSimulation.fire',
  RESET_SIMULATION_EVENT: 'tokenSimulation.reset',
  TRANSITION_FIRED_EVENT: 'tokenSimulation.firedTransition'
};
