import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/sequelize';
import { User } from './User';

export type TFAQ = {
  id: number;
  maincategory_ko: string;
  maincategory_en: string;
  subcategory_ko: string;
  subcategory_en: string;
  question_ko: string;
  question_en: string;
  answer_ko: object;
  answer_en: object;
  createdAt: Date;
  createdBy: number | null;
  updatedAt: Date;
  updatedBy: number | null;
};

export class FAQ extends Model<TFAQ> implements TFAQ {
  public id!: number;
  public maincategory_ko!: string;
  public maincategory_en!: string;
  public subcategory_ko!: string;
  public subcategory_en!: string;
  public question_ko!: string;
  public question_en!: string;
  public answer_ko!: object;
  public answer_en!: object;
  public createdAt!: Date;
  public createdBy!: number | null;
  public updatedAt!: Date;
  public updatedBy!: number | null;

  static associate() {
    FAQ.belongsTo(User, {
      foreignKey: 'createdBy',
      as: 'creator',
      onDelete: 'SET NULL',
    });
    FAQ.belongsTo(User, {
      foreignKey: 'updatedBy',
      as: 'updater',
      onDelete: 'SET NULL',
    });
  }
}

FAQ.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    maincategory_ko: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    maincategory_en: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    subcategory_ko: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    subcategory_en: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    question_ko: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    question_en: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    answer_ko: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    answer_en: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'FAQ',
    tableName: 'faqs',
    timestamps: false,
    underscored: true,
  }
);

export default FAQ;
