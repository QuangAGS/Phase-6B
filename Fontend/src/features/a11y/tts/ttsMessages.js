/**
 * PATH: src/features/a11y/tts/ttsMessages.js
 * DATETIME: 2026-05-16 15:30 GMT+7
 * VERSION: 24.6.7
 * DESCRIPTION:
 * - Canonical spoken UX repository for EGAL.
 * - Single source of truth for TTS guidance / spoken UX copy.
 * - Does NOT replace validation error messages, success messages, toast messages, labels, placeholders, or UI-only text.
 *
 * Q1-BẢO TỒN:
 * - Không thay đổi business flow.
 * - Không thay đổi UI/UX ngoài phạm vi spoken guidance.
 * - Không đổi tên hàm/thủ tục/biến toàn cục đang có, ngoại trừ việc chuẩn hóa export message nếu file này đã dùng export const TTS_MESSAGES.
 *
 * Q2-CODE FORMAT:
 * - File có PATH, DATETIME, VERSION, DESCRIPTION.
 * - Mỗi cụm message có <dateTime> và mô tả mục đích.
 */

/**
 * <2026-05-16 15:30 GMT+7>
 * PURPOSE:
 * - TTS_MESSAGES là nguồn sự thật duy nhất cho spoken UX / voice guidance.
 * - Form/Page chỉ import và consume message.
 * - Không hard-code lại spoken guidance trong component, trừ local override có ghi chú rõ ràng.
 */
export const TTS_MESSAGES = {
  /**
   * <2026-05-16 15:30 GMT+7>
   * PURPOSE:
   * - Common spoken guidance dùng chung cho nhiều form/page.
   */
  common: {
    captcha: {
      instruction:
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      required:
        'Bác cần bấm vào ô vuông để xác minh trước khi tiếp tục.',
    },

    processing:
      'Hệ thống đang xử lý. Bác vui lòng chờ trong giây lát.',

    genericError:
      'Có lỗi xảy ra. Bác vui lòng thử lại sau.',
  },

  /**
   * <2026-05-16 15:30 GMT+7>
   * PURPOSE:
   * - Spoken guidance cho nhóm Auth forms.
   */
  auth: {
    login: {
      overview:
        'Bác vui lòng nhập số điện thoại hoặc email, sau đó nhập mật khẩu để đăng nhập.',
      identifier:
        'Bác nhập số điện thoại hoặc email đã đăng ký.',
      password:
        'Bây giờ bác nhập mật khẩu.',
      captcha:
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        'Bác có thể bấm nút đăng nhập.',
    },

    forgotPassword: {
      overview:
        'Bác nhập email hoặc số điện thoại đã đăng ký để nhận mã xác nhận đặt lại mật khẩu.',
      identifier:
        'Bác nhập email hoặc số điện thoại đã đăng ký.',
      captcha:
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        'Bác bấm nút gửi mã xác nhận để tiếp tục.',
      locked:
        'Hệ thống đang tạm khóa yêu cầu gửi mã. Bác vui lòng chờ thêm trước khi thử lại.',
    },

    verifyResetCode: {
      overview:
        'Bác nhập mã xác nhận gồm sáu số mà hệ thống đã gửi.',
      code:
        'Bác nhập sáu số xác nhận vừa nhận được.',
      captcha:
        'Bác hãy bấm vào ô vuông. Khi thấy dấu tích màu xanh là đã xác nhận xong.',
      submit:
        'Sau khi nhập đủ mã xác nhận, bác bấm nút xác minh.',
    },

    changePassword: {
      overview:
        'Bác nhập mật khẩu mới và nhập lại mật khẩu một lần nữa để xác nhận.',
      newPassword:
        'Bác nhập mật khẩu mới.',
      confirmPassword:
        'Bác nhập lại mật khẩu mới để xác nhận.',
      submit:
        'Nếu mật khẩu đã đúng, bác bấm nút đổi mật khẩu.',
    },
  },

  /**
   * <2026-05-16 15:30 GMT+7>
   * PURPOSE:
   * - Spoken guidance cho nhóm đăng ký/gia nhập/tạo dòng họ.
   */
  clan: {
    join: {
      overview:
        'Bác hãy nhập thông tin theo thứ tự từ trên xuống dưới. Nếu cần, Bác bấm vào nút Nghe kèm biểu tượng chiếc loa để được nghe hướng dẫn.',
      clanSearch:
        'Bác nhập tên dòng họ cần tìm.',
      personalInfo:
        'Bác nhập thông tin cá nhân để Ban quản trị xác minh.',
      contact:
        'Bác chọn kênh liên lạc thuận tiện nhất.',
      accountPhone:
        'Bác nhập số điện thoại đăng nhập.',
      accountPassword:
        'Bác nhập mật khẩu đăng nhập.',
      submit:
        'Bác tiếp tục sang phần tiếp theo để hoàn tất hồ sơ.',
    },

    create: {
      overview:
        'Bác hãy nhập thông tin theo thứ tự từ trên xuống dưới. Nếu cần, Bác bấm vào nút Nghe kèm biểu tượng chiếc loa để được nghe hướng dẫn.',
      clanName:
        'Bác nhập tên dòng họ cần tạo và mô tả ngắn về dòng họ của bác',
      adminInfo:
        'Bác nhập đầy đủ thông tin của người sẽ trở thành quản trị viên dòng họ.',
      accountPhone:
        'Bác nhập số điện thoại đăng nhập.',
      notificationEmail:
        'Bác nhập email nhận thông báo.',
      accountPassword:
        'Bác nhập mật khẩu đăng nhập.',
      submit:
        'Bác tiếp tục sang phần tiếp theo để hoàn tất hồ sơ.',
    },
  },

  /**
   * <2026-05-16 15:30 GMT+7>
   * PURPOSE:
   * - Spoken guidance cho review/waiting page.
   */
  waitingPage: {
    review:
      'Bác kiểm tra lại toàn bộ thông tin hiển thị trên màn hình.',
    submit:
      'Nếu thông tin đã đúng, bác có thể gửi hồ sơ.',
    approvedHint:
      'Nếu hồ sơ được phê duyệt, bác có thể đăng nhập để sử dụng hệ thống.',
  },
};

export const ttsMessages = {
  login: {
    help: TTS_MESSAGES.auth.login.overview,
    identifierFocus: TTS_MESSAGES.auth.login.identifier,
    passwordFocus: TTS_MESSAGES.auth.login.password,
    captchaFocus: TTS_MESSAGES.common.captcha.instruction,
    submitFocus: TTS_MESSAGES.auth.login.submit,
  },

  forgotPassword: {
    help: TTS_MESSAGES.auth.forgotPassword.overview,
    identifierFocus: TTS_MESSAGES.auth.forgotPassword.identifier,
    captchaFocus: TTS_MESSAGES.common.captcha.instruction,
    submitFocus: TTS_MESSAGES.auth.forgotPassword.submit,
    locked: TTS_MESSAGES.auth.forgotPassword.locked,
  },

  verifyResetCode: {
    help: TTS_MESSAGES.auth.verifyResetCode.overview,
    codeFocus: TTS_MESSAGES.auth.verifyResetCode.code,
    captchaFocus: TTS_MESSAGES.common.captcha.instruction,
    submitFocus: TTS_MESSAGES.auth.verifyResetCode.submit,
  },

  changePassword: {
    help: TTS_MESSAGES.auth.changePassword.overview,
    newPasswordFocus: TTS_MESSAGES.auth.changePassword.newPassword,
    confirmPasswordFocus: TTS_MESSAGES.auth.changePassword.confirmPassword,
    submitFocus: TTS_MESSAGES.auth.changePassword.submit,
  },
/**
 * <2026-05-16T19:00:00+07:00>
 * VERSION: 24.6.7.R1.1
 * PURPOSE:
 * - Compatibility layer cho Register / JoinClan / CreateClan.
 * - Giữ Form/Page chỉ consume spoken UX từ ttsMessages.
 * - Không để JoinClanForm/CreateClanForm tự định nghĩa spoken guidance local.
 */

  // giữ nguyên các nhóm login / forgotPassword / verifyResetCode / changePassword hiện có

  register: {
    intentHelp:
      'Bác chọn Gia nhập một dòng họ nếu dòng họ đã có trong hệ thống. Bác chọn Tạo mới một dòng họ nếu muốn đăng ký dòng họ chưa có.',
    intentTitle:
      'Bác muốn đăng ký theo cách nào?',
    intentSubtitle:
      'Bác chọn một trong hai hình thức bên dưới để hệ thống hướng dẫn từng bước.',
  },

  joinClan: {
    help:
      TTS_MESSAGES.clan.join.overview,
    clanSearch:
      TTS_MESSAGES.clan.join.clanSearch,
    personalInfo:
      TTS_MESSAGES.clan.join.personalInfo,
    contactChannel:
      TTS_MESSAGES.clan.join.contact,
    accountInfo:
      'Bác nhập số điện thoại cùng mật khẩu và nên nhập cả email để tạo tài khoản đăng nhập.',
    captcha:
      TTS_MESSAGES.common.captcha.instruction,
    submit:
      TTS_MESSAGES.clan.join.submit,
  },

  createClan: {
    help:
      TTS_MESSAGES.clan.create.overview,
    clanNameFocus:
      TTS_MESSAGES.clan.create.clanName,
    personalInfo:
      TTS_MESSAGES.clan.create.adminInfo,
    contactInfo:
      'Bác nhập số điện thoại và email của quản trị viên dòng họ.',
    passwordFocus:
      TTS_MESSAGES.clan.create.accountPassword,
    captcha:
      TTS_MESSAGES.common.captcha.instruction,
    submit:
      TTS_MESSAGES.clan.create.submit,
  },
};

export default TTS_MESSAGES;

