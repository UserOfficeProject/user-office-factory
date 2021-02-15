import handlebar from 'handlebars';

import { FileMetadata } from '../../models/File';
import { Attachment } from '../../types';

handlebar.registerHelper('$attachment', function(
  attachments: Attachment[],
  attachmentsFileMeta: FileMetadata[]
) {
  return attachments
    .map(({ id, figure }) => {
      const foundIndex = attachmentsFileMeta.findIndex(
        ({ fileId }) => fileId === id
      );

      if (foundIndex === -1) {
        return 'Error: attachment info not found: ' + id;
      }

      const attachmentFileMeta = attachmentsFileMeta[foundIndex];

      return figure
        ? `<em>See appendix Figure ${figure}</em>`
        : `<em>See appendix ${attachmentFileMeta.originalFileName}</em>`;
    })
    .join('<br/>');
});
