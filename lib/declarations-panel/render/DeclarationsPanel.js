import {
  useState,
  useMemo,
  useEffect,
  useCallback
} from '@bpmn-io/properties-panel/preact/hooks';

import {
  find,
  isArray,
  reduce
} from 'min-dash';

import { PropertiesPanel } from '@bpmn-io/properties-panel';

import {
  DeclarationsPanelContext
} from '../context';

import { PanelHeaderProvider } from './PanelHeaderProvider';
import { PanelPlaceholderProvider } from './PanelPlaceholderProvider';

import { Events } from '../../common/EventBusEvents';

/**
 * @param {Object} props
 * @param {djs.model.Base|Array<djs.model.Base>} [props.element]
 * @param {Injector} props.injector
 * @param { (djs.model.Base) => Array<PropertiesProvider> } props.getProviders
 * @param {Object} props.layoutConfig
 * @param {Object} props.descriptionConfig
 * @param {Object} props.tooltipConfig
 * @param {HTMLElement} props.feelPopupContainer
 * @param {Function} props.getFeelPopupLinks
 */
export default function DeclarationsPanel(props) {
  const {
    element,
    injector,
    getProviders,
    layoutConfig: initialLayoutConfig,
    descriptionConfig,
    tooltipConfig,
    feelPopupContainer,
    getFeelPopupLinks
  } = props;

  const canvas = injector.get('canvas');
  const elementRegistry = injector.get('elementRegistry');
  const eventBus = injector.get('eventBus');
  const translate = injector.get('translate');

  const [ state, setState ] = useState({
    selectedElement: element
  });
  const [ _simulationModeRerender, _setSimulationModeRerender ] = useState(0);

  const selectedElement = state.selectedElement;

  const _update = (element) => {

    if (!element) {
      return;
    }

    let newSelectedElement = element;

    // handle labels
    if (newSelectedElement && newSelectedElement.type === 'label') {
      newSelectedElement = newSelectedElement.labelTarget;
    }

    setState({
      ...state,
      selectedElement: newSelectedElement
    });

    // notify interested parties on property panel updates
    eventBus.fire(Events.PROPERTIES_PANEL_UPDATED, {
      element: newSelectedElement
    });
  };

  // (2) react on element changes

  // (2a) selection changed
  useEffect(() => {
    const onSelectionChanged = (e) => {
      const { newSelection = [] } = e;

      if (newSelection.length > 1) {
        return _update(newSelection);
      }

      const newElement = newSelection[0];

      const rootElement = canvas.getRootElement();

      if (isImplicitRoot(rootElement)) {
        return;
      }

      _update(newElement || rootElement);
    };

    eventBus.on(Events.SELECTION_CHANGED, onSelectionChanged);

    return () => {
      eventBus.off(Events.SELECTION_CHANGED, onSelectionChanged);
    };
  }, []);

  // (2b) selected element changed
  useEffect(() => {
    const onElementsChanged = (e) => {
      const elements = e.elements;

      const updatedElement = findElement(elements, selectedElement);

      if (updatedElement && elementExists(updatedElement, elementRegistry)) {
        _update(updatedElement);
      }
    };

    eventBus.on(Events.ELEMENTS_CHANGED, onElementsChanged);

    return () => {
      eventBus.off(Events.ELEMENTS_CHANGED, onElementsChanged);
    };
  }, [ selectedElement ]);

  // (2c) root element changed
  useEffect(() => {
    const onRootAdded = (e) => {
      const element = e.element;

      _update(element);
    };

    eventBus.on(Events.ROOT_ADDED, onRootAdded);

    return () => {
      eventBus.off(Events.ROOT_ADDED, onRootAdded);
    };
  }, [ selectedElement ]);

  // (2d) provided entries changed
  useEffect(() => {
    const onProvidersChanged = () => {
      _update(selectedElement);
    };

    eventBus.on(Events.PROPERTIES_PANEL_PROVIDERS_CHANGED, onProvidersChanged);

    return () => {
      eventBus.off(Events.PROPERTIES_PANEL_PROVIDERS_CHANGED, onProvidersChanged);
    };
  }, [ selectedElement ]);

  // (2e) element templates changed
  useEffect(() => {
    const onTemplatesChanged = () => {
      _update(selectedElement);
    };

    eventBus.on(Events.ELEMENT_TEMPLATES_CHANGED, onTemplatesChanged);

    return () => {
      eventBus.off(Events.ELEMENT_TEMPLATES_CHANGED, onTemplatesChanged);
    };
  }, [ selectedElement ]);

  // (2f) simulation mode toggled
  useEffect(() => {
    function onToggle() {
      _setSimulationModeRerender(x => x + 1);
    }

    eventBus.on(Events.TOGGLE_MODE_EVENT, onToggle);
    return () => eventBus.off(Events.TOGGLE_MODE_EVENT, onToggle);
  }, [ eventBus ]);

  // (3) create properties panel context
  const declarationsPanelContext = {
    selectedElement,
    injector,
    getService(type, strict) { return injector.get(type, strict); }
  };

  // (4) retrieve groups for selected element
  const providers = getProviders(selectedElement);

  const groups = useMemo(() => {
    return reduce(providers, function(groups, provider) {

      // do not collect groups for multi element state
      if (isArray(selectedElement)) {
        return [];
      }

      const updater = provider.getGroups(selectedElement);

      return updater(groups);
    }, []);
  }, [ providers, selectedElement ]);

  // (5) notify layout changes
  const [ layoutConfig, setLayoutConfig ] = useState(initialLayoutConfig || {});

  const onLayoutChanged = useCallback((newLayout) => {
    eventBus.fire(Events.PROPERTIES_PANEL_LAYOUT_CHANGED, {
      layout: newLayout
    });
  }, [ eventBus ]);

  // React to external layout changes
  useEffect(() => {
    const cb = (e) => {
      const { layout } = e;
      setLayoutConfig(layout);
    };

    eventBus.on(Events.PROPERTIES_PANEL_SET_LAYOUT, cb);
    return () => eventBus.off(Events.PROPERTIES_PANEL_SET_LAYOUT, cb);
  }, [ eventBus, setLayoutConfig ]);

  // (6) notify description changes
  const onDescriptionLoaded = (description) => {
    eventBus.fire(Events.PROPERTIES_PANEL_DESCRIPTION_LOADED, {
      description
    });
  };

  // (7) notify tooltip changes
  const onTooltipLoaded = (tooltip) => {
    eventBus.fire(Events.PROPERTIES_PANEL_TOOLTIP_LOADED, {
      tooltip
    });
  };

  return <DeclarationsPanelContext.Provider value={ declarationsPanelContext }>
    <PropertiesPanel
      element={ selectedElement }
      headerProvider={ PanelHeaderProvider(translate) }
      placeholderProvider={ PanelPlaceholderProvider(translate) }
      groups={ groups }
      layoutConfig={ layoutConfig }
      layoutChanged={ onLayoutChanged }
      descriptionConfig={ descriptionConfig }
      descriptionLoaded={ onDescriptionLoaded }
      tooltipConfig={ tooltipConfig }
      tooltipLoaded={ onTooltipLoaded }
      feelPopupContainer={ feelPopupContainer }
      getFeelPopupLinks={ getFeelPopupLinks }
      eventBus={ eventBus } />
  </DeclarationsPanelContext.Provider>;
}


// helpers //////////////////////////

function isImplicitRoot(element) {
  return element && element.isImplicit;
}

function findElement(elements, element) {
  return find(elements, (e) => e === element);
}

function elementExists(element, elementRegistry) {
  return element && elementRegistry.get(element.id);
}
