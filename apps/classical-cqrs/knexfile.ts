import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { Knex } from 'knex'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASE_DIR = resolve(__dirname, 'src', 'db')

const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  },
  useNullAsDefault: true,
  migrations: {
    directory: resolve(BASE_DIR, 'migrations'),
    extension: 'ts'
  }
}

export const testConfig: Knex.Config = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: './test.db'
  }
}

export default config
