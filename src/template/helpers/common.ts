import handlebar from 'handlebars';

handlebar.registerHelper('$eq', function(a, b) {
  return a === b;
});

handlebar.registerHelper('$sum', function(...args) {
  args.pop();

  return args.reduce((sum, curr) => sum + curr, 0);
});
