var server = require('../src/index.js');

var port = process.env.PORT || 3000
server.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
