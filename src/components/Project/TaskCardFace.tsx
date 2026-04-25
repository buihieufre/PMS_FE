import { forwardRef, memo, type CSSProperties } from 'react';

import { MoreVertical, Users, MessageSquare, CheckSquare, Clock, AlignLeft, Pencil } from 'lucide-react';

import {

  getTaskMetaStyle,

  getCardListTitleColor,

  isTaskCoverImageUrl,

  getCoverStripStyle,

  type TaskCoverMode,

} from '@/lib/boardBackgroundStyle';

import { taskDescriptionHasContent } from '@/lib/taskDescription';

import type { DraggableStateSnapshot } from '@hello-pangea/dnd';



export type BoardTask = {

  id: string;

  title: string;

  description?: string;

  status: string;

  dueDate?: string;

  startDate?: string;

  background?: string | null;

  textColor?: string | null;

  coverMode?: TaskCoverMode | null;

  assignees?: { id: string; displayName: string; avatarUrl?: string }[];

  labels?: { id: string; name: string; color: string }[];

  checklists?: any[];

  activities?: any[];

  attachments?: any[];

};



export type TaskCardFaceProps = {

  task: BoardTask;

  snapshot: DraggableStateSnapshot;

  onOpenMenu: (e: React.MouseEvent, id: string) => void;

  showEditControls: boolean;

} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'style'> & {

  style?: CSSProperties;

  onClick?: React.MouseEventHandler<HTMLDivElement>;

};



const TaskCardFaceInner = forwardRef<HTMLDivElement, TaskCardFaceProps>(function TaskCardFaceInner(

  { task, snapshot, onOpenMenu, showEditControls, className, style, onClick, ...rest },

  ref

) {

  const bg = task.background;

  const coverIsImage = isTaskCoverImageUrl(bg);

  const hasBg = Boolean(bg && String(bg).trim());

  const hasCoverImage = hasBg && coverIsImage;

  const hasCoverColor = hasBg && !coverIsImage;

  const hasStrip = hasCoverImage || hasCoverColor;



  const meta = getTaskMetaStyle(task.textColor || null, false);



  const titleColor = getCardListTitleColor(task.textColor, { surface: hasStrip ? 'white' : 'plain' });



  const metaLineStyle = (): { color: string; borderTopColor: string } => {

    if (hasStrip) {

      return { color: '#64748b', borderTopColor: '#e2e8f0' };

    }

    return { color: meta.color, borderTopColor: meta.borderTopColor };

  };



  const borderC = snapshot.isDragging ? 'rgba(99, 102, 241, 0.45)' : '#e2e8f0';



  const outerStyle: CSSProperties = {

    borderColor: borderC,

    backgroundColor: '#ffffff',

    ...style,

  };



  const menuBtnOnLight =

    'p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 outline-none transition-colors';

  const menuBtnOnCover =

    'p-1.5 rounded-lg text-white/95 hover:text-white bg-black/25 hover:bg-black/40 outline-none transition-colors';



  const dateBadgeClass =

    'flex items-center px-2 py-1 bg-rose-100 text-rose-800 rounded-md text-[10px] font-bold shadow-sm';



  const bodyBlock = () => (

    <>

      {task.labels && task.labels.length > 0 && (

        <div className="mb-2 flex flex-wrap gap-1.5">

          {task.labels.map((label) => (

            <div

              key={label.id}

              className="h-2 w-10 cursor-pointer rounded-full transition-opacity hover:opacity-80"

              style={{ backgroundColor: label.color }}

              title={label.name || ''}

            />

          ))}

        </div>

      )}

      <h4 className="mb-2 text-sm font-bold transition-colors group-hover:opacity-90" style={{ color: titleColor }}>

        {task.title}

      </h4>



      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200/90 pt-3" style={metaLineStyle()}>

        {task.dueDate && (

          <div className={dateBadgeClass}>

            <Clock className="mr-1 h-3 w-3" />

            {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' })}

          </div>

        )}



        {taskDescriptionHasContent(task.description) && (

          <div className="opacity-80" title="Thẻ đã có miêu tả.">

            <AlignLeft className="h-3.5 w-3.5" />

          </div>

        )}



        {(() => {

          const commentCount = (task.activities || []).filter((a: any) => a.type === 'COMMENT').length;

          if (commentCount === 0) return null;

          return (

            <div className="flex items-center text-[11px] font-medium opacity-90">

              <MessageSquare className="mr-1 h-3.5 w-3.5 shrink-0" />

              {commentCount}

            </div>

          );

        })()}



        {(() => {

          const total = (task.checklists || []).reduce((acc, cl) => acc + (cl.items?.length || 0), 0);

          const done = (task.checklists || []).reduce(

            (acc, cl) => acc + (cl.items?.filter((i: any) => i.isDone).length || 0),

            0

          );

          if (total === 0) return null;

          return (

            <div className="flex items-center text-[11px] font-medium opacity-90">

              <CheckSquare className="mr-1 h-3.5 w-3.5 shrink-0" />

              {done}/{total}

            </div>

          );

        })()}

      </div>



      <div className="mt-3 flex h-5 items-center justify-end">

        {task.assignees && task.assignees.length > 0 ? (

          <div className="flex -space-x-1.5">

            {task.assignees.slice(0, 3).map((a) => (

              <div

                key={a.id}

                className="h-5 w-5 overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 shadow-sm"

                title={a.displayName}

              >

                <img

                  src={a.avatarUrl || `https://ui-avatars.com/api/?name=${a.displayName}&background=random&size=20`}

                  alt="avatar"

                  className="h-full w-full object-cover"

                />

              </div>

            ))}

            {task.assignees.length > 3 && (

              <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 text-[7px] font-bold text-slate-500 shadow-sm">

                +{task.assignees.length - 3}

              </div>

            )}

          </div>

        ) : (

          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 bg-transparent">

            <Users className="h-2.5 w-2.5 text-slate-300" />

          </div>

        )}

      </div>

    </>

  );



  const whiteBodyInCard = (

    <div className="relative bg-white p-4">

      {showEditControls && (

        <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">

          <button type="button" onClick={(e) => onOpenMenu(e, task.id)} className={menuBtnOnLight}>

            <MoreVertical className="h-4 w-4" />

          </button>

        </div>

      )}

      {bodyBlock()}

    </div>

  );



  const dragChrome = !showEditControls

    ? 'cursor-default transition-shadow'

    : snapshot.isDragging

      ? 'z-[9999] scale-105 cursor-grabbing rotate-3 shadow-2xl ring-2 ring-indigo-300/50'

      : 'cursor-grab transition-all hover:shadow-md';



  return (

    <div

      ref={ref}

      data-task-card-wrap

      {...rest}

      onClick={onClick}

      className={`group relative overflow-hidden rounded-xl border shadow-sm p-0 ${dragChrome} ${className || ''}`}

      style={outerStyle}

    >

      {hasCoverImage && bg && (

        <div className="relative h-[7.5rem] w-full shrink-0 overflow-hidden bg-slate-800/95">

          <div

            className="h-full w-full bg-center bg-no-repeat"

            style={{

              backgroundImage: `url(${String(bg).trim()})`,

              backgroundSize: 'contain',

              backgroundPosition: 'center',

            }}

          />

          {showEditControls && (

            <div className="absolute right-2 top-2 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">

              <button

                type="button"

                title="Chỉnh sửa thẻ"

                onClick={(e) => {

                  e.stopPropagation();

                  onOpenMenu(e, task.id);

                }}

                className={menuBtnOnCover}

              >

                <Pencil className="h-3.5 w-3.5" />

              </button>

            </div>

          )}

        </div>

      )}



      {hasCoverColor && bg && (

        <div className="relative h-[7.5rem] w-full shrink-0 overflow-hidden" style={getCoverStripStyle(String(bg))} />

      )}



      {hasStrip && whiteBodyInCard}



      {!hasStrip && (

        <div className="relative p-4">

          {showEditControls && (

            <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">

              <button type="button" onClick={(e) => onOpenMenu(e, task.id)} className={menuBtnOnLight}>

                <MoreVertical className="h-4 w-4" />

              </button>

            </div>

          )}

          {bodyBlock()}

        </div>

      )}

    </div>

  );

});



export const TaskCardFace = memo(TaskCardFaceInner);

