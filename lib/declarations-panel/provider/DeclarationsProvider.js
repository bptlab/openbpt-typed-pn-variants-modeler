import { Group, ListGroup } from '@bpmn-io/properties-panel';

import {
  IdProps,
  NameProps,
  ModelDeclarationsProps,
  PlaceProps,
  VariableArcProps,
} from './properties';

function GeneralGroup(element, injector) {
  const translate = injector.get('translate');

  const entries = [
    ...IdProps({ element }),
    ...NameProps({ element }),
  ];

  return {
    id: 'general',
    label: translate('General'),
    entries,
    component: Group
  };

}

function ModelDeclarationsGroup(element, injector) {
  const translate = injector.get('translate');
  const group = {
    label: translate('Model Declarations'),
    id: 'model-declarations',
    component: ListGroup,
    ...ModelDeclarationsProps({ element, injector })
  };

  if (group.items) {
    return group;
  }
  return null;
}

function PlaceGroup(element, injector) {
  const translate = injector.get('translate');
  const group = {
    label: translate('Place Properties'),
    id: 'place-properties',
    component: Group,
    entries: [
      ...PlaceProps({ element })
    ]
  };

  if (group.entries.length) {
    return group;
  }

  return null;
}

function VariableArcGroup(element, injector) {
  const translate = injector.get('translate');
  const group = {
    label: translate('Variable Arc Properties'),
    id: 'variable-arc-properties',
    component: Group,
    entries: [
      ...VariableArcProps({ element })
    ]
  };

  if (group.entries.length) {
    return group;
  }

  return null;
}

// function CompensationGroup(element, injector) {
//   const translate = injector.get('translate');
//   const group = {
//     label: translate('Compensation'),
//     id: 'compensation',
//     component: Group,
//     entries: [
//       ...CompensationProps({ element })
//     ]
//   };

//   if (group.entries.length) {
//     return group;
//   }

//   return null;
// }

function getGroups(element, injector) {

  const groups = [
    GeneralGroup(element, injector),
    ModelDeclarationsGroup(element, injector),
    PlaceGroup(element, injector),
    VariableArcGroup(element, injector),
    // CompensationGroup(element, injector),
  ];

  // contract: if a group returns null, it should not be displayed at all
  return groups.filter(group => group !== null);;
}

export default class DeclarationsProvider {

  constructor(declarationsPanel, injector) {
    declarationsPanel.registerProvider(this);
    this._injector = injector;
  }

  getGroups(element) {
    return (groups) => {
      groups = groups.concat(getGroups(element, this._injector));
      return groups;
    };
  }

}

DeclarationsProvider.$inject = [ 'declarationsPanel', 'injector' ];
