export const handleClickEmail = (email: string) => {
  const domain = email.substring(email.lastIndexOf('@') + 1);
  let mailServiceUrl = '';

  switch (domain) {
    case 'mail.ru':
    case 'bk.ru':
    case 'list.ru':
    case 'inbox.ru':
      mailServiceUrl = 'https://e.mail.ru/';
      break;
    case 'yandex.ru':
    case 'ya.ru':
      mailServiceUrl = 'https://mail.yandex.ru';
      break;
    case 'yandex.ua':
      mailServiceUrl = 'https://mail.yandex.ua/';
      break;
    case 'yandex.by':
      mailServiceUrl = 'https://mail.yandex.by/';
      break;
    case 'yandex.kz':
      mailServiceUrl = 'https://mail.yandex.kz/';
      break;
    case 'yandex.com':
      mailServiceUrl = 'https://mail.yandex.com/';
      break;
    case 'gmail.com':
    case 'googlemail.com':
      mailServiceUrl = 'https://mail.google.com/';
      break;
    case 'outlook.com':
    case 'hotmail.com':
    case 'live.ru':
    case 'live.com':
      mailServiceUrl = 'https://mail.live.com/';
      break;
    case 'me.com':
    case 'icloud.com':
      mailServiceUrl = 'https://www.icloud.com/';
      break;
    case 'rambler.ru':
      mailServiceUrl = 'https://mail.rambler.ru/';
      break;
    case 'yahoo.com':
      mailServiceUrl = 'https://mail.yahoo.com/';
      break;
    case 'ukr.net':
      mailServiceUrl = 'https://mail.ukr.net/';
      break;
    case 'i.ua':
      mailServiceUrl = 'http://mail.i.ua/';
      break;
    case 'bigmir.net':
      mailServiceUrl = 'http://mail.bigmir.net/';
      break;
    case 'tut.by':
      mailServiceUrl = 'https://mail.tut.by/';
      break;
    case 'inbox.lv':
      mailServiceUrl = 'https://www.inbox.lv/';
      break;
    case 'mail.kz':
      mailServiceUrl = 'http://mail.kz/';
      break;
    default:
      mailServiceUrl = `mailto:${email}`;
      break;
  }
  window.open(mailServiceUrl, '_blank');
};
