import { MODELER_PREFIX } from "../util/constants";


function createModal(position) {
  const modal = document.createElement('div');
  modal.className = 'custom-token-modal';
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

function createForm(inputFields, onSubmit, onCancel) {
  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '10px';

  inputFields.forEach((inputField) => {
    form.appendChild(inputField.label);
    form.appendChild(inputField.input);
  });

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
  cancelBtn.onclick = onCancel;

  buttonRow.appendChild(confirmBtn);
  buttonRow.appendChild(cancelBtn);
  form.appendChild(buttonRow);

  form.onsubmit = onSubmit;

  return form;
}

export function renderCreateTokenModal(position, place, customElementFactory, commandStack) {

  const existingModal = document.querySelector('.custom-token-modal');
  if (existingModal) existingModal.remove();

  const color = place.businessObject.color || [];
  const modal = createModal(position);

  const inputFields = color.map(dataClass =>
    createInputField(dataClass.name, dataClass.id)
  );

  // Modal cleanup logic
  function removeModal() {
    if (modal.parentNode) modal.parentNode.removeChild(modal);
    document.removeEventListener('keydown', escKeyListener);
    document.removeEventListener('mousedown', outsideClickListener);
  }

  function escKeyListener(e) {
    if (e.key === 'Escape') removeModal();
  }

  function outsideClickListener(e) {
    if (!modal.contains(e.target)) removeModal();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const inputValues = inputFields.map(inputField => inputField.input);

    const tokenValues = inputValues.map(input => {
      const dataClass = color.find(dc => dc.id === input.name);
      const tokenValue = customElementFactory.create(
        `${MODELER_PREFIX}:TokenValue`,
        {
          dataClass,
          value: input.value
        }
      );
      return tokenValue;
    });

    // Create the token with the input values
    const token = customElementFactory.create(
      `${MODELER_PREFIX}:Token`,
      {
        values: tokenValues
      }
    );
    tokenValues.forEach((value) => {
      value.$parent = token;
    });
    token.$parent = place;

    const existingTokens = place.businessObject.marking || [];
    commandStack.execute('element.updateProperties', {
      element: place,
      properties: {
        marking: [...existingTokens, token]
      }
    });

    removeModal(modal);
  };

  function handleCancel(e) {
    e.preventDefault();
    removeModal();
  }

  const form = createForm(inputFields, handleSubmit, handleCancel);

  modal.appendChild(form);
  document.body.appendChild(modal);
  document.addEventListener('keydown', escKeyListener);
  document.addEventListener('mousedown', outsideClickListener);
}
