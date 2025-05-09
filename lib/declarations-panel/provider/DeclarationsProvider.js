import { Group } from '@bpmn-io/properties-panel';

import {
  IdProps,
  NameProps,
} from './properties';

function GeneralGroup(element, injector) {
  const translate = injector.get('translate');

  const entries = [
    ...NameProps({ element }),
    ...IdProps({ element })
  ];

  return {
    id: 'general',
    label: translate('General'),
    entries,
    component: Group
  };

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
    // CompensationGroup(element, injector),
  ];

  // contract: if a group returns null, it should not be displayed at all
  return groups.filter(group => group !== null);
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
