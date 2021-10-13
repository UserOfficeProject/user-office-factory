import handlebar from 'handlebars';

handlebar.registerHelper('$utcDate', function(date: string | Date) {
  return new Date(date).toISOString().split('T')[0];
});
