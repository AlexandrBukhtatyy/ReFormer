// base — pure shadcn MessageScroller (AI авто-скролл списка сообщений): compound
// Provider / Root / Viewport / Content / Item / Button поверх headless-примитива
// @shadcn/react/message-scroller. Не form-control. Экспортируются и behaviour-хуки
// (useMessageScroller / …Scrollable / …Visibility) для императивного скролла и статуса.
export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from './variants/base/message-scroller-base';
