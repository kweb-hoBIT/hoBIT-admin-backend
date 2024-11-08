import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/sequelize';
import { FAQ } from './FAQ';

// 유저가 입력한 질문 log를 저장하는 table
export type TQuestionLog = {
  id: number;
  faq_id: number | null;
  user_question: string;
  feedback_score: number | null;
  feedback: string | null;
  created_at: Date;
  language: string;
};

export class QuestionLog extends Model<TQuestionLog> implements TQuestionLog {
  public id!: number;
  public faq_id!: number | null;
  public user_question!: string;
  public feedback_score!: number | null;
  public feedback!: string | null;
  public created_at!: Date;
  public language!: string;

  static associate() {
    QuestionLog.belongsTo(FAQ, {
      foreignKey: 'faqId',
      as: 'faq',
      onDelete: 'SET NULL',
    });
  }
}

QuestionLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    faq_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    user_question: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    language: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    feedback_score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    feedback: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    modelName: 'QuestionLog',
    tableName: 'question_logs',
    timestamps: false,
    underscored: true,
  }
);

export default QuestionLog;
