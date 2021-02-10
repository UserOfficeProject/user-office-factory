import handlebar from 'handlebars';

handlebar.registerHelper('$eq', function(a, b) {
  return a === b;
});

handlebar.registerHelper('$sum', function(...args) {
  args.pop();

  return args.reduce((sum, curr) => sum + curr, 0);
});

handlebar.registerHelper('$join', function(src, delimiter) {
  if (!Array.isArray(src)) {
    return src;
  }

  return src.join(delimiter);
});

handlebar.registerHelper('$attachment', function(
  attachmentIds: any[],
  attachments: any[]
) {
  return attachmentIds
    .map(({ id, figure }) => {
      const foundIndex = attachments.findIndex(({ fileId }) => fileId === id);

      if (foundIndex === -1) {
        return 'Error: attachment info not found: ' + id;
      }

      const attachment = attachments[foundIndex];

      return figure
        ? `<em>See appendix Figure ${figure}</em>`
        : `<em>See appendix ${attachment.originalFileName}</em>`;
    })
    .join('<br/>');
});
