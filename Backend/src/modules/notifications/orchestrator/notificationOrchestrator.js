/**
 * PATH:
 * backend/src/modules/notifications/orchestrator/notificationOrchestrator.js
 *
 * PURPOSE:
 * - EGAL-25 Sprint 25.0
 * - Notification orchestration skeleton
 * - Persist-first architecture
 * - Policy-driven routing
 * - No actual delivery yet
 *
 * CURRENT BEHAVIOR:
 * event
 * -> resolve severity/reliability
 * -> create notification
 * -> create recipient
 * -> resolve routes
 * -> create delivery placeholders
 *
 * DOCTRINE:
 * Business emits intent.
 * Orchestrator persists.
 * Policy decides.
 * Adapters deliver later.
 */

const deliveryExecutionService = require(
  '../services/deliveryExecution.service'
);

const notificationRepository = require(
  '../repository/notification.repository'
);

const communicationRepository = require(
  '../repository/communication.repository'
);

const deliveryRepository = require(
  '../repository/delivery.repository'
);

const reliabilityPolicy = require(
  '../policy/reliabilityPolicy'
);

const routingPolicy = require(
  '../policy/routingPolicy'
);

/**
 * Temporary event text catalog.
 *
 * NOTE:
 * This is NOT routing policy.
 * It only provides default title/content.
 *
 * Future:
 * Move to templates/
 */
const EVENT_TEXT = {
  PASSWORD_RESET_REQUESTED: {
    title: 'Yêu cầu đặt lại mật khẩu',
    content:
      'Hệ thống đã ghi nhận yêu cầu đặt lại mật khẩu của bác.',
  },

  PASSWORD_CHANGED: {
    title: 'Mật khẩu đã được thay đổi',
    content:
      'Mật khẩu tài khoản của bác đã được thay đổi.',
  },

  USER_REGISTERED: {
    title: 'Đăng ký tài khoản thành công',
    content:
      'Hệ thống đã tiếp nhận hồ sơ đăng ký của bác.',
  },

  USER_APPROVAL_PENDING: {
    title: 'Hồ sơ đang chờ phê duyệt',
    content:
      'Hồ sơ của bác đang chờ Ban Quản trị phê duyệt.',
  },

  USER_APPROVED: {
    title: 'Hồ sơ đã được phê duyệt',
    content:
      'Tài khoản của bác đã được phê duyệt.',
  },

  USER_REJECTED: {
    title: 'Hồ sơ chưa được phê duyệt',
    content:
      'Hồ sơ của bác chưa được phê duyệt.',
  },

  SECURITY_ALERT: {
    title: 'Cảnh báo bảo mật',
    content:
      'Hệ thống ghi nhận hoạt động cần chú ý.',
  },

  ACCOUNT_LOCKED: {
    title: 'Tài khoản tạm thời bị khóa',
    content:
      'Tài khoản của bác đang tạm thời bị khóa.',
  },

  SUSPICIOUS_LOGIN: {
    title: 'Cảnh báo đăng nhập',
    content:
      'Hệ thống ghi nhận hoạt động đăng nhập cần chú ý.',
  },

  ROLE_CHANGED: {
    title: 'Vai trò tài khoản đã thay đổi',
    content:
      'Vai trò tài khoản của bác đã được cập nhật.',
  },

  COMMUNICATION_BINDING_REMINDER: {
    title: 'Nhắc kết nối kênh liên lạc',
    content:
      'Bác có thể kết nối kênh liên lạc ưa thích để nhận thông báo thuận tiện hơn.',
  },
};

function resolveText(eventType, payload = {}) {
  const fallback =
    EVENT_TEXT[eventType] || {};

  return {
    title:
      payload.title ||
      fallback.title ||
      'Thông báo hệ thống',

    content:
      payload.content ||
      fallback.content ||
      'Hệ thống có cập nhật mới.',
  };
}

function resolveDeliveryRecipient({
  channel,
  user,
  binding,
}) {
  switch (channel) {
    case 'EMAIL':
      return user?.email || null;

    case 'ZALO':
      return (
        binding?.external_id ||
        user?.phone ||
        null
      );

    case 'TELEGRAM':
      return (
        binding?.external_id ||
        null
      );

    case 'WHATSAPP':
      return (
        binding?.external_id ||
        user?.phone ||
        null
      );

    case 'IN_APP':
    default:
      return null;
  }
}

class NotificationOrchestrator {
  /**
   * Emit business event.
   *
   * Sprint 25.0:
   * Persist only.
   *
   * @param {String} eventType
   * @param {Object} payload
   * @param {Object|null} currentUser
   *
   * payload:
   * {
   *   userId: string,
   *   title?: string,
   *   content?: string,
   *   level?: NotificationSeverity,
   *   reliability?: ReliabilityLevel,
   *   metadata?: object,
   *   channels?: ChannelType[],
   *   includeOpportunistic?: boolean,
   *   executeImmediately?: boolean
   * }
   */
  async emit(
    eventType,
    payload = {},
    currentUser = null
  ) {
    if (!eventType) {
      throw new Error(
        '[notificationOrchestrator.emit]: eventType is required'
      );
    }

    const userId = payload.userId;

    if (!userId) {
      throw new Error(
        '[notificationOrchestrator.emit]: payload.userId is required'
      );
    }

    // =====================================================
    // STEP 1
    // Resolve text
    // =====================================================

    const { title, content } =
      resolveText(eventType, payload);

    // =====================================================
    // STEP 2
    // Resolve severity + reliability via policy
    // =====================================================

    const level =
      reliabilityPolicy.resolveSeverity(
        eventType,
        payload.level
      );

    const reliability =
      reliabilityPolicy.resolveReliability(
        eventType,
        payload.reliability
      );

    // =====================================================
    // STEP 3
    // Create canonical notification + recipient
    // =====================================================

    const {
      notification,
      recipient,
    } =
      await notificationRepository.createNotificationForUser({
        userId,
        eventType,
        title,
        content,
        level,
        reliability,
        metadata: payload.metadata || {},
        currentUser,
      });

    // =====================================================
    // STEP 4
    // Load preference + bindings
    // =====================================================

    const user =
      await communicationRepository.getUserBasicProfile(
        userId
      );

    const preference =
      await communicationRepository.getPreferredPreference(
        userId
      );

    const bindings =
      await communicationRepository.getBindings(userId);

    // =====================================================
    // STEP 5
    // Resolve routes via routing policy
    // =====================================================

    const routeResult =
      routingPolicy.resolveRoutes({
        eventType,
        preference,
        bindings,
        overrideChannels: payload.channels || null,
        includeOpportunistic:
          payload.includeOpportunistic !== false,
      });

    // =====================================================
    // STEP 6
    // Create delivery placeholders
    //
    // No actual sending yet.
    // =====================================================

    const deliveries = [];

    for (const route of routeResult.routes) {
      const binding =
        bindings.find(
          (item) =>
            item.channel === route.channel
        ) || null;

      const deliveryRecipient =
        resolveDeliveryRecipient({
          channel: route.channel,
          user,
          binding,
        });

      const delivery =
        await deliveryRepository.createDelivery({
          notificationId:
            notification.id,

          notificationRecipientId:
            recipient.id,

          channel:
            route.channel,

          recipient:
            deliveryRecipient,

          status:
            route.status,

          rawResponse: {
            source: 'ORCHESTRATOR',
            eventType,
            manualRequired:
              route.manualRequired,
            bindingState:
              route.bindingState,
            connected:
              route.connected,
            suggested:
              route.suggested,
          },

          currentUser,
        });

      deliveries.push(delivery);
    }

    // =====================================================
    // STEP 7
    // Optional immediate execution
    //
    // Default: false for Q1-safe behavior.
    // =====================================================

    let executedDeliveries = null;

    if (payload.executeImmediately === true) {
      executedDeliveries =
        await deliveryExecutionService.executeMany({
          deliveries,
          notification,
          user,
          bindings,
          currentUser,
        });
    }

    return {
      success: true,
      eventType,

      level,
      reliability,

      routeResult,

      notification,
      recipient,
      deliveries,
      executedDeliveries,
    };
  }

  /**
   * Emit system notification
   * without authenticated user.
   */
  async emitSystem(
    eventType,
    payload = {}
  ) {
    return this.emit(
      eventType,
      payload,
      null
    );
  }
}

module.exports =
  new NotificationOrchestrator();