import { LoggerModule } from '@DSAV-CQRSES-RPM/logger'
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { INestApplication } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import supertest from 'supertest'
import { CqrsModule } from '@nestjs/cqrs'
import { KnexModule } from 'nest-knexjs'
import { UserController } from './user.controller.js'
import { UserRepository } from './user.repository.js'
import { UserMainProjection } from './projections/user-main.projection.js'
import { commandHandlers, userEventHandlers, queryHandlers } from './user.module.js'
import knex from 'knex'
import { InfraModule } from '../infra/infra.module.js'
import { testConfig } from '../../knexfile.js'

describe('UserController (e2e)', () => {
  const context = {
    user: { id: '' }
  }

  let db: knex.Knex
  let app: INestApplication

  beforeAll(() => {
    db = knex(testConfig)
  })

  afterAll(async () => {
    await db.schema.dropTable('users')
    await db.schema.dropTable('users-snapshot')
    await db.destroy()
  })

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        LoggerModule.forRoot(),
        CqrsModule,
        InfraModule,
        KnexModule.forRootAsync({
          useFactory: () => ({
            config: testConfig
          })
        })
      ],
      controllers: [UserController],
      providers: [...commandHandlers, ...queryHandlers, ...userEventHandlers, UserRepository, UserMainProjection]
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('Users /create (POST)', (done) => {
    expect(process.env.NODE_ENV).toBe('test')

    supertest(app.getHttpServer())
      .post('/users/create')
      .send({ password: '12345678' })
      .expect(200)
      .then((response) => {
        expect(response.text).toEqual('Acknowledgement OK')
        done()
      })
      .catch((err) => done(err))
  })

  // ToDo: implement test for change password endpoint after adding get method to the controller
/*
  it('Users /main (GET)', (done) => {
    expect(process.env.NODE_ENV).toBe('test')

    supertest(app.getHttpServer())
      .get('/users/main')
      .expect(200)
      .then((response) => {
        expect(response.body.length).toEqual(1)
        context.user = response.body[0]
        done()
      })
      .catch((err) => done(err))
  })

  it('Users /main/:id (GET)', (done) => {
    expect(process.env.NODE_ENV).toBe('test')

    supertest(app.getHttpServer())
      .get(`/users/main/${context.user.id}`)
      .expect(200)
      .then((response) => {
        expect(response.body.id).toEqual(context.user.id)
        done()
      })
      .catch((err) => done(err))
  })*/
})
