import { getNewShapePosition } from './CustomAutoPlaceUtil';
import { Events } from '../common/EventBusEvents';

export default function CustomAutoPlace(eventBus) {
  eventBus.on(Events.AUTO_PLACE, function(context) {
    const shape = context.shape;
    const source = context.source;

    return getNewShapePosition(source, shape);
  });
}

CustomAutoPlace.$inject = [
  'eventBus'
];
