function resolveLocalMongoUri(input) {
  const uri = String(input || '').trim();
  if (!uri) return uri;

  if (uri.includes('@mongodb:')) {
    return uri.replace('@mongodb:', '@127.0.0.1:');
  }

  if (uri.includes('@mongodb/')) {
    return uri.replace('@mongodb/', '@127.0.0.1/');
  }

  if (uri.startsWith('mongodb://mongodb:')) {
    return uri.replace('mongodb://mongodb:', 'mongodb://127.0.0.1:');
  }

  if (uri.startsWith('mongodb://mongodb/')) {
    return uri.replace('mongodb://mongodb/', 'mongodb://127.0.0.1/');
  }

  return uri;
}

module.exports = {
  resolveLocalMongoUri,
};
