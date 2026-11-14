import test from 'node:test';
import assert from 'node:assert/strict';
import {launcherEndpoint,desktopHeaders} from '../lib/launcher-endpoints.js';
test('desktop proxy permits only the intended launcher endpoints and methods',()=>{
  for(const path of ['auth/device/start','auth/device/poll','auth/refresh','auth/logout']) assert.equal(launcherEndpoint(path,'POST'),true);
  for(const path of ['me','me/matches','account','builds','status','leaderboard']) assert.equal(launcherEndpoint(path,'GET'),true);
  for(const path of ['internal/matches/abc/results','admin/players','web/registration/complete','auth/register','device/approve']) assert.equal(launcherEndpoint(path,'POST'),false);
  assert.equal(launcherEndpoint('me','DELETE'),false);
  assert.equal(desktopHeaders['access-control-allow-origin'],'null');
  assert.equal('access-control-allow-credentials' in desktopHeaders,false);
});
