import DeclarationsPanel from './DeclarationsPanel';
import { Events } from '../../common/EventBusEvents';

import {
  isUndo,
  isRedo
} from 'diagram-js/lib/features/keyboard/KeyboardUtil';

import {
  render
} from '@bpmn-io/properties-panel/preact';

import {
  domify,
  query as domQuery,
  event as domEvent
} from 'min-dom';

const DEFAULT_PRIORITY = 1000;


export default class DeclarationsPanelRenderer {

  constructor(config, injector, eventBus) {
    const {
      parent,
      layout: layoutConfig,
      description: descriptionConfig,
      tooltip: tooltipConfig,
      feelPopupContainer,
      getFeelPopupLinks
    } = config || {};

    this._eventBus = eventBus;
    this._injector = injector;
    this._layoutConfig = layoutConfig;
    this._descriptionConfig = descriptionConfig;
    this._tooltipConfig = tooltipConfig;
    this._feelPopupContainer = feelPopupContainer;
    this._getFeelPopupLinks = getFeelPopupLinks;

    this._container = domify(
      '<div style="height: 100%" tabindex="-1" class="bio-properties-panel-container"></div>'
    );

    const commandStack = injector.get('commandStack', false);

    commandStack && setupKeyboard(this._container, eventBus, commandStack);

    eventBus.on(Events.DIAGRAM_INIT, () => {
      if (parent) {
        this.attachTo(parent);
      }
      else {
        this.attachTo(injector.get("canvas")._container.parentNode.parentNode.children[1]);
      }
    });

    eventBus.on(Events.DIAGRAM_DESTROY, () => {
      this.detach();
    });

    eventBus.on(Events.ROOT_ADDED, (event) => {
      const { element } = event;

      this._render(element);
    });
  }


  // Attach the properties panel to a parent node.
  attachTo(container) {
    if (!container) {
      throw new Error('container required');
    }

    // unwrap jQuery if provided
    if (container.get && container.constructor.prototype.jquery) {
      container = container.get(0);
    }

    if (typeof container === 'string') {
      container = domQuery(container);
    }

    // (1) detach from old parent
    this.detach();

    // (2) append to parent container
    container.appendChild(this._container);

    // (3) notify interested parties
    this._eventBus.fire(Events.PROPERTIES_PANEL_ATTACH);
  }

  // Detach the properties panel from its parent node.
  detach() {
    const parentNode = this._container.parentNode;

    if (parentNode) {
      parentNode.removeChild(this._container);

    this._eventBus.fire(Events.PROPERTIES_PANEL_DETACH);
    }
  }

  // Register a new properties provider to the properties panel.
  registerProvider(priority, provider) {

    if (!provider) {
      provider = priority;
      priority = DEFAULT_PRIORITY;
    }

    if (typeof provider.getGroups !== 'function') {
      console.error(
        'Properties provider does not implement #getGroups(element) API'
      );

      return;
    }

    this._eventBus.on(Events.PROPERTIES_PANEL_GET_PROVIDERS, priority, function(event) {
      event.providers.push(provider);
    });

    this._eventBus.fire(Events.PROPERTIES_PANEL_PROVIDERS_CHANGED);
  }

  // Updates the layout of the properties panel.
  setLayout(layout) {
    this._eventBus.fire(Events.PROPERTIES_PANEL_SET_LAYOUT, { layout });
  }

  _getProviders() {
    const event = this._eventBus.createEvent({
      type: Events.PROPERTIES_PANEL_GET_PROVIDERS,
      providers: []
    });

    this._eventBus.fire(event);

    return event.providers;
  }

  _render(element) {
    const canvas = this._injector.get('canvas');

    if (!element) {
      element = canvas.getRootElement();
    }

    if (isImplicitRoot(element)) {
      return;
    }

    render(
      <DeclarationsPanel
        element={ element }
        injector={ this._injector }
        getProviders={ this._getProviders.bind(this) }
        layoutConfig={ this._layoutConfig }
        descriptionConfig={ this._descriptionConfig }
        tooltipConfig={ this._tooltipConfig }
        feelPopupContainer={ this._feelPopupContainer }
        getFeelPopupLinks={ this._getFeelPopupLinks }
      />,
      this._container
    );

    this._eventBus.fire(Events.PROPERTIES_PANEL_RENDERED);
  }

  _destroy() {
    if (this._container) {
      render(null, this._container);

    this._eventBus.fire(Events.PROPERTIES_PANEL_DESTROYED);
    }
  }
}

DeclarationsPanelRenderer.$inject = [ 'config.propertiesPanel', 'injector', 'eventBus' ];


// helpers ///////////////////////

function isImplicitRoot(element) {
  return element && element.isImplicit;
}

/**
 * Setup keyboard bindings (undo, redo) on the given container.
 *
 * @param {Element} container
 * @param {EventBus} eventBus
 * @param {CommandStack} commandStack
 */
function setupKeyboard(container, eventBus, commandStack) {

  function cancel(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleKeys(event) {

    if (isUndo(event)) {
      commandStack.undo();

      return cancel(event);
    }

    if (isRedo(event)) {
      commandStack.redo();

      return cancel(event);
    }
  }

  eventBus.on(Events.KEYBOARD_BIND, function() {
    domEvent.bind(container, 'keydown', handleKeys);
  });

  eventBus.on(Events.KEYBOARD_UNBIND, function() {
    domEvent.unbind(container, 'keydown', handleKeys);
  });
}
