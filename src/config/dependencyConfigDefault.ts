import 'reflect-metadata';
import { ConsoleLogger, setLogger } from '@user-office-software/duo-logger';

import { Tokens } from './Tokens';
import { mapValue } from './utils';

mapValue(Tokens.ConfigureLogger, () => setLogger(new ConsoleLogger()));
