import newAttachmentZIPWorkflowManager from './attachment';

export default function getZIPWorkflowManager(
  zipType: string,
  { data }: { data: any[] }
) {
  switch (zipType) {
    case 'attachment':
      return newAttachmentZIPWorkflowManager(data);

    default:
      throw new Error(`Unknown PDF type: ${zipType}`);
  }
}
