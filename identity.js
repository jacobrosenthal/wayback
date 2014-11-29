'use strict';

var googlePlusUserLoader = (function() {

  var STATE_START=1;
  var STATE_ACQUIRING_AUTHTOKEN=2;
  var STATE_AUTHTOKEN_ACQUIRED=3;

  var state = STATE_START;

  var signin_button, xhr_button, revoke_button, user_info_div, left_button, right_button;

 function disableButton(button) {
    button.setAttribute('disabled', 'disabled');
  }

  function enableButton(button) {
    button.removeAttribute('disabled');
  }

  function changeState(newState) {
    state = newState;
    switch (state) {
      case STATE_START:
        enableButton(signin_button);
        // disableButton(xhr_button);
        disableButton(revoke_button);
        break;
      case STATE_ACQUIRING_AUTHTOKEN:
        sampleSupport.log('Acquiring token...');
        disableButton(signin_button);
        // disableButton(xhr_button);
        disableButton(revoke_button);
        break;
      case STATE_AUTHTOKEN_ACQUIRED:
        disableButton(signin_button);
        // enableButton(xhr_button);
        enableButton(revoke_button);
        break;
    }
  }

  // @corecode_begin getProtectedData
  function xhrWithAuth(method, url, interactive, callback) {
    var access_token;

    var retry = true;

    getToken();

    function getToken() {
      chrome.identity.getAuthToken({ interactive: interactive }, function(token) {
        if (chrome.runtime.lastError) {
          callback(chrome.runtime.lastError);
          return;
        }

        access_token = token;
        requestStart();
      });
    }

    function requestStart() {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
      xhr.onload = requestComplete;
      xhr.send();
    }

    function requestComplete() {
      if (this.status == 401 && retry) {
        retry = false;
        chrome.identity.removeCachedAuthToken({ token: access_token },
                                              getToken);
      } else {
        callback(null, this.status, this.response);
      }
    }
  }

  function getMessages(after, before, destroy) {
    
    if(destroy){
      var fotorama=$('#fotorama').data('fotorama');
      fotorama.destroy();
    }

    xhrWithAuth('GET',
                'https://www.googleapis.com/gmail/v1/users/me/messages?q="after:' + after + ' before:' + before + ' has:attachment"',
                false,
                parseMessages);
  }
  // @corecode_end getProtectedData


  // Code updating the user interface, when the user information has been
  // fetched or displaying the error.
  function parseMessages(error, status, response) {
    if (!error && status == 200) {
      changeState(STATE_AUTHTOKEN_ACQUIRED);
      //sampleSupport.log(response);
      var user_info = JSON.parse(response);

      if(user_info.messages){
        user_info.messages.forEach(getMessage);
      }

    } else {
      changeState(STATE_START);
    }
  }

  function getMessage(element, index, array){

    xhrWithAuth('GET',
                'https://www.googleapis.com/gmail/v1/users/me/messages/' + element.id,
                true,
                parseMessage);

  }

  function parseMessage(error, status, response){

    if (!error && status == 200) {
      //sampleSupport.log(response);
      var user_info = JSON.parse(response);
      sampleSupport.log(user_info.snippet);
      // sampleSupport.log(user_info.payload.parts);
      user_info.payload.parts.forEach(getAttachment.bind(user_info.id));
    } else {
      changeState(STATE_START);
    }

  }

  function getAttachment(element, index, array){
    
    if(element.body['attachmentId']){
      xhrWithAuth('GET',
                  'https://www.googleapis.com/gmail/v1/users/me/messages/' + this + '/attachments/' + element.body['attachmentId'],
                  true,
                  parseAttachment.bind(element));
    }

  }

  function parseAttachment(error, status, response){

    if (!error && status == 200) {

      var user_info = JSON.parse(response);


      if(this.mimeType.search("image") != -1)
      {

        var group = document.querySelector('#fotorama');


        sampleSupport.log(this.filename);


      // <li data-pile="Group 1">
      //     <a href="#">
      //         <span class="tp-info">
      //             <span>Some title</span>
      //         </span>
      //         <img src="images/1.jpg" />
      //     </a>
      // </li>

        // var liElem = document.createElement('li');
        // liElem.setAttribute("data-pile", "group1");



        //gotta be some fucking api for this, oh well 
        var data =  user_info.data.replace(/[\_]/g, '/');
        data =  data.replace(/[-]/g, '+');

        data = "data:"  + this.mimeType + ";base64," + data


        var fotorama=$('#fotorama').data('fotorama');

        fotorama.push({
          img: data, 
          caption: this.filename,
        });



        // var imgElem = document.createElement('img');
        // imgElem.src = "data:" + this.mimeType + ";base64," + data;
        // imgElem.alt = this.filename;
        // imgElem.height = 400;

        // // liElem.insertAdjacentElement("afterbegin", imgElem);

        // group.insertAdjacentElement("afterbegin", imgElem);




      }

    } else {
      changeState(STATE_START);
    }

  }

  // OnClick event handlers for the buttons.

  /**
    Retrieves a valid token. Since this is initiated by the user
    clicking in the Sign In button, we want it to be interactive -
    ie, when no token is found, the auth window is presented to the user.

    Observe that the token does not need to be cached by the app.
    Chrome caches tokens and takes care of renewing when it is expired.
    In that sense, getAuthToken only goes to the server if there is
    no cached token or if it is expired. If you want to force a new
    token (for example when user changes the password on the service)
    you need to call removeCachedAuthToken()
  **/
  function interactiveSignIn() {
    changeState(STATE_ACQUIRING_AUTHTOKEN);

    // @corecode_begin getAuthToken
    // @description This is the normal flow for authentication/authorization
    // on Google properties. You need to add the oauth2 client_id and scopes
    // to the app manifest. The interactive param indicates if a new window
    // will be opened when the user is not yet authenticated or not.
    // @see http://developer.chrome.com/apps/app_identity.html
    // @see http://developer.chrome.com/apps/identity.html#method-getAuthToken
    chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
      if (chrome.runtime.lastError) {
        sampleSupport.log(chrome.runtime.lastError);
        changeState(STATE_START);
      } else {
        sampleSupport.log('Token acquired:'+token+
          '. See chrome://identity-internals for details.');
        changeState(STATE_AUTHTOKEN_ACQUIRED);

        var before = moment(after);
        before.add(7, 'days');

        getMessages( after.format("YYYY/MM/DD"), before.format("YYYY/MM/DD"), true );

      }
    });
    // @corecode_end getAuthToken
  }

  function revokeToken() {

    var fotorama=$('#fotorama').data('fotorama');
    fotorama.destroy();

    user_info_div.innerHTML="";
    chrome.identity.getAuthToken({ 'interactive': false },
      function(current_token) {
        if (!chrome.runtime.lastError) {

          // @corecode_begin removeAndRevokeAuthToken
          // @corecode_begin removeCachedAuthToken
          // Remove the local cached token
          chrome.identity.removeCachedAuthToken({ token: current_token },
            function() {});
          // @corecode_end removeCachedAuthToken

          // Make a request to revoke token in the server
          var xhr = new XMLHttpRequest();
          xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
                   current_token);
          xhr.send();
          // @corecode_end removeAndRevokeAuthToken

          // Update the user interface accordingly
          changeState(STATE_START);
          sampleSupport.log('Token revoked and removed from cache. '+
            'Check chrome://identity-internals to confirm.');
        }
    });
  }

  var after = moment().subtract(1, 'year');

  function leftWeek() {
    after.subtract(1, 'week');
    var navdate = document.querySelector('#nav-date');
    navdate.innerHTML = after.format("YYYY/MM/DD");

    var before = moment(after);
    before.add(7, 'days');

    getMessages( after.format("YYYY/MM/DD"), before.format("YYYY/MM/DD"), true );
  }

  function rightWeek() {
    after.add(1, 'week');
    var navdate = document.querySelector('#nav-date');
    navdate.innerHTML = after.format("YYYY/MM/DD");

    var before = moment(after);
    before.add(7, 'days');

    getMessages( after.format("YYYY/MM/DD"), before.format("YYYY/MM/DD"), true);
  }

  return {
    onload: function () {

      var navdate = document.querySelector('#nav-date');
      navdate.innerHTML = after.format("YYYY/MM/DD");

      signin_button = document.querySelector('#signin');
      signin_button.addEventListener('click', interactiveSignIn);

      // xhr_button = document.querySelector('#getxhr');
      // xhr_button.addEventListener('click', getMessages.bind(xhr_button, after.format("YYYY/MM/DD"), before.format("YYYY/MM/DD"), true));

      revoke_button = document.querySelector('#revoke');
      revoke_button.addEventListener('click', revokeToken);

      user_info_div = document.querySelector('#user_info');

      left_button = document.querySelector('#nav-left');
      left_button.addEventListener('click', leftWeek);

      right_button = document.querySelector('#nav-right');
      right_button.addEventListener('click', rightWeek);

      var before = moment(after);
      before.add(7, 'days');
      
      getMessages( after.format("YYYY/MM/DD"), before.format("YYYY/MM/DD"), true );

    }
  };

})();

window.onload = googlePlusUserLoader.onload;

