// Load requirements.
var $ = require('jquery');
var gp = require('genpass-lib');
var storage = require('./lib/localstorage-polyfill');

// Set default values.
var messageOrigin = false;
var messageSource = false;
var language = location.search.substring(1);
var latestBookmarklet = '../bookmarklet/bookmarklet.min.js';
var latestVersion = 20140531;

// Localizations.
var localizations = {
  'en':    ['Master password', 'Domain / URL', 'Generate'],
  'es':    ['Contraseña maestra', 'Dominio / URL', 'Enviar'],
  'fr':    ['Mot de passe principal', 'Domaine / URL', 'Soumettre'],
  'de':    ['Master Passwort', 'Domain / URL', 'Abschicken'],
  'pt-br': ['Senha-mestra', 'Domínio / URL', 'Gerar'],
  'zh-hk': ['主密碼', '域名 / URL', '提交'],
  'hu':    ['Mesterjelszó', 'Tartomány / Internetcím', 'OK'],
  'ru':    ['Мастер-пароль', 'Домена / URL', 'Подтвердить']
};

// Enumerate jQuery selectors for caching.
var $el = {};
var selectors =
  [
    'PasswdField',
    'Passwd',
    'PasswdLabel',
    'DomainField',
    'Domain',
    'DomainLabel',
    'Len',
    'Generate',
    'Mask',
    'Output',
    'Update',
    'Bookmarklet'
  ];

// Retrieve user's configuration from local storage, if available.
var config = {
  passwordLength: storage.local.getItem('Len') || 8,
  passwordCase:   storage.local.getItem('Case') || 'lowercase'
};

var showUpdateNotification = function (data) {
  $el.Bookmarklet.attr('href', data);
  $el.Update.show();
  sendDocumentHeight();
};

// Listen for postMessage from bookmarklet.
var listenForBookmarklet = function (event) {

  // Gather information.
  var post = event.originalEvent;
  messageSource = post.source;
  messageOrigin = post.origin;

  // Parse message.
  $.each(JSON.parse(post.data), function (key, value) {
    switch (key) {
    case 'version':
      if(value < latestVersion) {
        // Fetch latest bookmarklet.
        $.ajax({
          url: latestBookmarklet,
          success: showUpdateNotification,
          dataType: 'html'
        });
      }
      break;
    }
  });

  // Populate domain field and call back with the browser height.
  $el.Domain.val(gp.hostname(messageOrigin)).trigger('change');
  sendDocumentHeight();

};

// Send document height to bookmarklet.
var sendDocumentHeight = function () {
  postMessageToBookmarklet({
    height: $(document.body).height()
  });
};

// Send generated password to bookmarklet.
var sendGeneratedPassword = function (generatedPassword) {
  postMessageToBookmarklet({
    result: generatedPassword
  });
};

// Send message using HTML5 postMessage API. Only post a message if we are in
// communication with the bookmarklet.
var postMessageToBookmarklet = function (message) {
  if(messageSource && messageOrigin) {
    messageSource.postMessage(JSON.stringify(message), messageOrigin);
  }
};

// Save configuration to local storage.
var saveConfiguration = function (passwordLength, passwordCase) {
  storage.local.setItem('Len', passwordLength);
  storage.local.setItem('Case', passwordCase);
};

// Get selected password case.
var getPasswordCase = function () {
  return $('input:radio[name=Case]:checked').val() || 'lowercase';
};

// Validate password length.
var validatePasswordLength = function (passwordLength) {

  // Password length must be an integer.
  passwordLength = parseInt(passwordLength, 10) || 8;

  // Return a password length in the valid range.
	return Math.max(4, Math.min(passwordLength, 32));

};

var generatePassword = function (event) {

  // Get form input.
  var masterPassword = $el.Passwd.val();
  var domain = $el.Domain.val().replace(/ /g, '');
  var passwordLength = validatePasswordLength($el.Len.val());
  var passwordCase = getPasswordCase();

  // Process domain value.
  domain = (domain) ? gp.hostname(domain) : '';

  // Update form with validated input.
  $el.Domain.val(domain).trigger('change');
  $el.Len.val(passwordLength).trigger('change');

  // Show user feedback for missing master password.
  if(!masterPassword) {
     $el.PasswdField.addClass('Missing');
  }

  // Show user feedback for missing domain.
  if(!domain) {
     $el.DomainField.addClass('Missing');
  }

  // Generate password.
  if(masterPassword && domain) {

    // Compile GenPass options hash.
    var options = {
      length: passwordLength,
      passwordCase: passwordCase
    };

    // Generate password.
    generatedPassword = gp(masterPassword, domain, options);

    // Send generated password to bookmarklet.
    sendGeneratedPassword(generatedPassword);

    // Save form input to local storage.
    saveConfiguration(passwordLength, passwordCase);

    // Show generated password.
    $el.Generate.hide();
    $el.Output.text(generatedPassword);
    $el.Mask.show();

  }

};

// Show generated password on click/touch.
var showGeneratedPassword = function () {
  $el.Mask.hide();
  $el.Output.show().trigger('focus');
};

// Clear generated password when input changes.
var clearGeneratedPassword = function (event) {

  // Store reference to key press.
  var key = event.which;

  // Test for input key codes.
  var group1 = ([8, 32].indexOf(key) !== -1);
  var group2 = (key > 45 && key < 91);
  var group3 = (key > 95 && key < 112);
  var group4 = (key > 185 && key < 223);
  var enterKey = (key == 13);

  // When user enters form input, reset form status.
  if ( event.type == 'change' || group1 || group2 || group3 || group4 ) {

    // Clear generated password.
    $el.Mask.hide();
    $el.Output.text('').hide();

    // Show generate button.
    $el.Generate.show();

    // Clear feedback for missing form input.
    $el.PasswdField.removeClass('Missing');
    $el.DomainField.removeClass('Missing');

  }

  // Submit form on enter key.
  if (enterKey) {
    $(this).trigger('blur');
    $el.Generate.trigger('click');
    event.preventDefault();
  }

};

// Adjust password length.
var adjustPasswordLength = function (event) {

  // Get length increment.
  var increment = ( $(this).attr('id') == 'Up' ) ? 1 : -1;

  // Calculate new password length.
  var passwordLength = validatePasswordLength($el.Len.val());
  var newPasswordLength = validatePasswordLength(passwordLength + increment);

  // Update form with new password length.
  $el.Len.val(newPasswordLength).trigger('change');

  // Prevent event default action.
  event.preventDefault();

};

// Populate selector cache.
$.each(selectors, function (i, val) {
  $el[val] = $('#' + val);
});

// Load user's configuration (or defaults) into form.
$('input:radio[value=' + config.passwordCase + ']').prop('checked', true);
$el.Len.val(validatePasswordLength(config.passwordLength));

// Perform localization, if requested.
if (language && localizations.hasOwnProperty(language)) {
  $el.Passwd.attr('placeholder', localizations[language][0]);
  $el.Domain.attr('placeholder', localizations[language][1]);
  $el.PasswdLabel.text(localizations[language][0]);
  $el.DomainLabel.text(localizations[language][1]);
  $el.Generate.text(localizations[language][2]);
}

// Provide fake input placeholders if browser does not support them.
if ( !('placeholder' in document.createElement('input')) ) {
  $('#Passwd, #Secret, #Domain').on('keyup change', function (event) {
    $('label[for=' + $(this).attr('id') + ']').toggle($(this).val() === '');
  }).trigger('change');
}

// Bind to interaction events.
$el.Generate.on('click', generatePassword);
$el.Mask.on('click', showGeneratedPassword);
$('#Up, #Down').on('click', adjustPasswordLength);

// Bind to form events.
$('fieldset > input').on('keydown change', clearGeneratedPassword);

// Set focus on password field.
$el.Passwd.trigger('focus').trigger('change');

// Attach postMessage listener for bookmarklet.
$(window).on('message', listenForBookmarklet);
