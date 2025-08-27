export default function IdentifierService() {
  // Internal list of identifiers
  this.objectIdentifiers = [];

  this.getIdentifiers = () => {
    return Array.from(this.objectIdentifiers);
  };

  this.setIdentifiers = (ids) => {
    this.objectIdentifiers = Array.from(ids || []);
  };

  this.addIdentifier = (id) => {
    if (!this.objectIdentifiers.includes(id)) {
      this.objectIdentifiers.push(id);
    }
  };

  this.generateUniqueId = (dataClass) => {
    const dataClassName = dataClass.name;
    const existingIds = Array.from(this.objectIdentifiers).filter((id) =>
      new RegExp(`^${dataClassName}_\\d+$`).test(id)
    );

    let maxId = 0;
    existingIds.forEach((id) => {
      const match = id.match(new RegExp(`^${dataClassName}_(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    });

    const newId = `${dataClassName}_${maxId + 1}`;
    this.addIdentifier(newId);
    return newId;
  };
}

IdentifierService.$inject = [];
