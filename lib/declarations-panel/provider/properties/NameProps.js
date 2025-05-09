import { isAny } from '../../../util/Util';
import { TextAreaEntry, isTextAreaEntryEdited } from '@bpmn-io/properties-panel';
import { useService } from '../../hooks';
import { MODELER_PREFIX } from '../../../util/constants';


export function NameProps(props) {
  const {
    element
  } = props;

  if (isAny(element, [ `${MODELER_PREFIX}:Arc`, `${MODELER_PREFIX}:Model` ])) {
    return [];
  }

  return [
    {
      id: 'name',
      component: Name,
      isEdited: isTextAreaEntryEdited
    }
  ];
}

function Name(props) {
  const {
    element
  } = props;

  const modeling = useService('modeling');
  const debounce = useService('debounceInput');
  const translate = useService('translate');

  // (1) default: name
  let options = {
    element,
    id: 'name',
    label: translate('Name'),
    debounce,
    setValue: (value) => {
      modeling.updateProperties(element, {
        name: value
      });
    },
    getValue: (element) => {
      return element.businessObject.name;
    },
    autoResize: true
  };

  return TextAreaEntry(options);
}
