import { getBusinessObject } from "../../../util/Util";
import {
  TextFieldEntry,
  isTextFieldEntryEdited,
} from "@bpmn-io/properties-panel";
import { useCallback } from "@bpmn-io/properties-panel/preact/hooks";
import { useService } from "../../hooks";
import { isIdValid } from "../../Util";

export function IdProps() {
  return [
    {
      id: "id",
      component: Id,
      isEdited: isTextFieldEntryEdited,
    },
  ];
}

function Id(props) {
  const { element } = props;

  const modeling = useService("modeling");
  const debounce = useService("debounceInput");
  const translate = useService("translate");

  const setValue = (value, error) => {
    if (error) {
      return;
    }

    modeling.updateProperties(element, {
      id: value,
    });
  };

  const getValue = useCallback(
    (element) => {
      return getBusinessObject(element).id;
    },
    [element],
  );

  const validate = useCallback(
    (value) => {
      const businessObject = getBusinessObject(element);

      return isIdValid(businessObject, value, translate);
    },
    [element, translate],
  );

  return TextFieldEntry({
    element,
    id: "id",
    label: translate("ID"),
    getValue,
    setValue,
    debounce,
    validate,
  });
}
