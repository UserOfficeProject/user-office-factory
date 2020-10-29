import PostgresFileDataSource from './dataSources/postgres/FileDataSource';
import FileMutations from './mutations/FileMutations';
import FileQueries from './queries/FileQueries';

const fileDataSource = new PostgresFileDataSource();

export default {
  queries: {
    files: new FileQueries(fileDataSource),
  },
  mutations: {
    files: new FileMutations(fileDataSource),
  },
};
