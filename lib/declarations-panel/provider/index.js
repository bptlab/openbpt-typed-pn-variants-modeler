import DeclarationsProvider from "./DeclarationsProvider";
import IdentifierService from "./IdentifierService";

export default {
  __init__: ["declarationsProvider", "identifierService"],
  declarationsProvider: ["type", DeclarationsProvider],
  identifierService: ["type", IdentifierService],
};
