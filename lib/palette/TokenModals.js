import { MODELER_PREFIX } from "../util/constants";

function removeExistingModal() {
  const existingModal = document.querySelector('.custom-token-modal');
  if (existingModal) existingModal.remove();
}

function createModal(position) {
  // Create modal and apply CSS class
  const modal = document.createElement('div');
  modal.className = 'custom-token-modal';
  // Position modal at event coordinates
  modal.style.position = 'fixed';
  modal.style.left = `${position.x}px`;
  modal.style.top = `${position.y}px`;
  return modal;
}

function createInputField(labelText, name) {
  const label = document.createElement('label');
  label.textContent = `Value for "${labelText}":`;
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.required = true;
  return { label, input };
}

function createForm(inputFields) {
  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '10px';

  inputFields.forEach((inputField) => {
    form.appendChild(inputField.label);
    form.appendChild(inputField.input);
  });

  // Button row
  const buttonRow = document.createElement('div');
  buttonRow.className = 'custom-token-btn-row';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'submit';
  confirmBtn.textContent = 'Add Token';
  confirmBtn.className = 'custom-token-btn';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'custom-token-btn';
  cancelBtn.onclick = () => document.body.removeChild(modal);

  buttonRow.appendChild(confirmBtn);
  buttonRow.appendChild(cancelBtn);
  form.appendChild(buttonRow);
  return form;
}

export function renderCreateTokenModal(position, place, elementFactory, commandStack) {
  const color = place.businessObject.color || [];

  removeExistingModal();
  const modal = createModal(position);

  const inputFields = [];
  color.forEach((dataClass) => {
    const inputField = createInputField(dataClass.name, dataClass.id);
    inputFields.push(inputField);
  });

  const form = createForm(inputFields);

  form.onsubmit = (e) => {
    e.preventDefault();
    const values = inputFields.map(inputField => inputField.input);
    console.log(values);

    const tokenValues = [];
    values.forEach((value) => {
      const dataClass = color.find(dc => dc.id === value.name);
      const tokenValue = elementFactory.create(
        `${MODELER_PREFIX}:TokenValue`,
        {
          dataClass,
          value: value.value
        }
      );
      tokenValues.push(tokenValue);
    });

    // Create the token with the input values
    const token = elementFactory.create(
      `${MODELER_PREFIX}:Token`,
      {
        values: tokenValues
      }
    );
    tokenValues.forEach((value) => {
      value.$parent = token;
    });
    token.$parent = place;
    console.log(token);

    const existingTokens = place.businessObject.marking || [];

    commandStack.execute('element.updateProperties', {
      element: place,
      properties: {
        marking: [...existingTokens, token]
      }
    });

    document.body.removeChild(modal);
  };

  modal.appendChild(form);
  document.body.appendChild(modal);
}