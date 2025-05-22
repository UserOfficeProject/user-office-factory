//import 'reflect-metadata';
import './default/dependencyConfig';

//Import custom dependence if set.
if (process.env.DEPENDENCY_CONFIG == 'stfc') {
  require('./stfc/dependencyConfig');
}

export {};
